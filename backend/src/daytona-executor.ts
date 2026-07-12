import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import { z } from 'zod'
import type { ArtifactStore } from './artifacts.js'
import type { Artifact, Run, TestPlan } from './domain.js'
import type { RepositorySettings } from './store.js'
import { compilePlaywrightScript } from './playwright-compiler.js'
import type { Executor } from './runner.js'

interface SandboxLike {
  fs: { uploadFile(data: Buffer, path: string): Promise<unknown>; downloadFile(path: string): Promise<Buffer> }
  process: { executeCommand(command: string, cwd?: string, env?: Record<string, string>, timeout?: number): Promise<{ exitCode: number; result?: string }> }
  delete(timeout?: number): Promise<unknown>
}
export interface DaytonaClientLike { create(params?: unknown, options?: unknown): Promise<SandboxLike> }

const ManifestSchema = z.object({
  results: z.array(z.object({ testId: z.string(), status: z.enum(['passed', 'failed']), classification: z.enum(['confirmed','flaky','inconclusive']).optional(), durationMs: z.number().nonnegative(), error: z.string().optional() })),
  findings: z.array(z.object({ id: z.string(), testId: z.string(), title: z.string(), severity: z.enum(['low', 'medium', 'high']), category: z.enum(['functional','accessibility','console','network']).optional(), classification: z.enum(['confirmed','flaky','inconclusive']).optional(), details: z.string(), expected:z.string().optional(), actual:z.string().optional(), reproduction:z.array(z.string()).optional(), consoleErrors:z.array(z.string()).optional(), networkErrors:z.array(z.string()).optional(), artifactIds: z.array(z.string()) })),
  files: z.array(z.object({ kind: z.enum(['video', 'screenshot', 'trace','log']), path: z.string().startsWith('/workspace/freebug/evidence/'), testId:z.string().optional(), attempt:z.number().int().positive().optional() })),
})

export class DaytonaExecutor implements Executor {
  constructor(private readonly client: DaytonaClientLike, private readonly store: ArtifactStore, private readonly options: { snapshot?: string; timeoutSeconds: number }, private readonly repositoryContext: (repository:string)=>{settings?:RepositorySettings;secrets:Record<string,string>} = ()=>({secrets:{}})) {}

  async execute(run: Run) {
    if (!run.plan) throw new Error('Run has no test plan')
    const dir = await mkdtemp(join(tmpdir(), 'freebug-daytona-'))
    const repository = run.repository ? this.repositoryContext(run.repository) : {secrets:{}}
    const plan = withLogin(run.plan, repository.settings)
    const script = compilePlaywrightScript(plan, run.targetUrl)
    const localScript = join(dir, 'test.mjs')
    await writeFile(localScript, script)
    const artifacts: Artifact[] = [await this.store.saveFile(run.id, 'script', localScript)]
    const createParams = this.options.snapshot
      ? { snapshot: this.options.snapshot, language: 'javascript', ephemeral: true, labels: { freebugRun: run.id } }
      : { image: 'mcr.microsoft.com/playwright:v1.61.1-noble', language: 'javascript', ephemeral: true, labels: { freebugRun: run.id } }
    const sandbox = await this.client.create(createParams, { timeout: this.options.timeoutSeconds })
    try {
      await sandbox.fs.uploadFile(Buffer.from(script), '/workspace/freebug/test.mjs')
      await sandbox.fs.uploadFile(Buffer.from(JSON.stringify({ type: 'module', dependencies: { playwright: '1.61.1', '@axe-core/playwright': '4.12.1' } })), '/workspace/freebug/package.json')
      const command = await sandbox.process.executeCommand('npm install --omit=dev --no-audit --no-fund && node test.mjs', '/workspace/freebug', repository.secrets, this.options.timeoutSeconds)
      if (command.exitCode !== 0) throw new Error(`Sandbox test process failed: ${redact(command.result ?? `exit ${command.exitCode}`,repository.secrets)}`)
      const manifest = ManifestSchema.parse(JSON.parse((await sandbox.fs.downloadFile('/workspace/freebug/results.json')).toString()))
      for (const remote of manifest.files) {
        const local = join(dir, basename(remote.path))
        const downloaded=await sandbox.fs.downloadFile(remote.path)
        await writeFile(local,remote.kind==='log'?redact(downloaded.toString(),repository.secrets):downloaded)
        artifacts.push(await this.store.saveFile(run.id, remote.kind, local, { testId:remote.testId, attempt:remote.attempt }))
      }
      const byTest = (testId:string) => artifacts.filter(artifact=>artifact.testId===testId||(artifact.kind==='video'&&!artifact.testId)).map(artifact=>artifact.id)
      return { results: manifest.results.map(result=>{const safe=result.error?{...result,error:redact(result.error,repository.secrets)}:result;const ids=byTest(result.testId);return ids.length?{...safe,artifactIds:ids}:safe}), findings: manifest.findings.map(finding=>({...finding,details:redact(finding.details,repository.secrets),actual:finding.actual?redact(finding.actual,repository.secrets):undefined,consoleErrors:finding.consoleErrors?.map(value=>redact(value,repository.secrets)),networkErrors:finding.networkErrors?.map(value=>redact(value,repository.secrets)),artifactIds:byTest(finding.testId)})), artifacts }
    } finally {
      await sandbox.delete(120).catch(() => undefined)
      await rm(dir, { recursive: true, force: true })
    }
  }
}

function withLogin(plan:TestPlan,settings?:RepositorySettings):TestPlan{
  if(!settings?.loginPath||!settings.loginSteps.length)return plan
  const login=[{action:'goto' as const,path:settings.loginPath},...settings.loginSteps]
  return {...plan,tests:plan.tests.map(test=>({...test,steps:[...login,...test.steps]}))}
}
const redact=(value:string,secrets:Record<string,string>)=>Object.values(secrets).reduce((text,secret)=>secret?text.replaceAll(secret,'[REDACTED]'):text,value)

export class PrSandboxExecutor implements Executor {
  constructor(private readonly local: Executor, private readonly sandbox: Executor) {}
  execute(run: Run) { return run.mode === 'pr' ? this.sandbox.execute(run) : this.local.execute(run) }
}
