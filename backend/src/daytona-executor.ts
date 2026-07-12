import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import { z } from 'zod'
import type { ArtifactStore } from './artifacts.js'
import type { Artifact, Run } from './domain.js'
import { compilePlaywrightScript } from './playwright-compiler.js'
import type { Executor } from './runner.js'

interface SandboxLike {
  fs: { uploadFile(data: Buffer, path: string): Promise<unknown>; downloadFile(path: string): Promise<Buffer> }
  process: { executeCommand(command: string, cwd?: string, env?: Record<string, string>, timeout?: number): Promise<{ exitCode: number; result?: string }> }
  delete(timeout?: number): Promise<unknown>
}
export interface DaytonaClientLike { create(params?: unknown, options?: unknown): Promise<SandboxLike> }

const ManifestSchema = z.object({
  results: z.array(z.object({ testId: z.string(), status: z.enum(['passed', 'failed']), durationMs: z.number().nonnegative(), error: z.string().optional() })),
  findings: z.array(z.object({ id: z.string(), testId: z.string(), title: z.string(), severity: z.enum(['low', 'medium', 'high']), details: z.string(), artifactIds: z.array(z.string()) })),
  files: z.array(z.object({ kind: z.enum(['video', 'screenshot', 'trace']), path: z.string().startsWith('/workspace/freebug/evidence/') })),
})

export class DaytonaExecutor implements Executor {
  constructor(private readonly client: DaytonaClientLike, private readonly store: ArtifactStore, private readonly options: { snapshot?: string; timeoutSeconds: number }) {}

  async execute(run: Run) {
    if (!run.plan) throw new Error('Run has no test plan')
    const dir = await mkdtemp(join(tmpdir(), 'freebug-daytona-'))
    const script = compilePlaywrightScript(run.plan, run.targetUrl)
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
      const command = await sandbox.process.executeCommand('npm install --omit=dev --no-audit --no-fund && node test.mjs', '/workspace/freebug', undefined, this.options.timeoutSeconds)
      if (command.exitCode !== 0) throw new Error(`Sandbox test process failed: ${command.result ?? `exit ${command.exitCode}`}`)
      const manifest = ManifestSchema.parse(JSON.parse((await sandbox.fs.downloadFile('/workspace/freebug/results.json')).toString()))
      for (const remote of manifest.files) {
        const local = join(dir, basename(remote.path))
        await writeFile(local, await sandbox.fs.downloadFile(remote.path))
        artifacts.push(await this.store.saveFile(run.id, remote.kind, local))
      }
      return { results: manifest.results, findings: manifest.findings, artifacts }
    } finally {
      await sandbox.delete(120).catch(() => undefined)
      await rm(dir, { recursive: true, force: true })
    }
  }
}

export class PrSandboxExecutor implements Executor {
  constructor(private readonly local: Executor, private readonly sandbox: Executor) {}
  execute(run: Run) { return run.mode === 'pr' ? this.sandbox.execute(run) : this.local.execute(run) }
}
