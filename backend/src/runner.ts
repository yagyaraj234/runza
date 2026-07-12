import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type ConsoleMessage, type Request as PlaywrightRequest } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'
import type { Artifact, Finding, Run, TestCase, TestResult } from './domain.js'
import type { ArtifactStore } from './artifacts.js'
import { compilePlaywrightScript } from './playwright-compiler.js'

export interface Executor { execute(run: Run): Promise<{ results: TestResult[]; findings: Finding[]; artifacts: Artifact[] }> }

type SecretProvider = (run: Run) => Promise<Record<string, string>> | Record<string, string>
type Attempt = {
  error?: string
  durationMs: number
  consoleErrors: string[]
  networkErrors: string[]
  accessibility: string[]
  artifactIds: string[]
}

export class PlaywrightExecutor implements Executor {
  constructor(private readonly store: ArtifactStore, private readonly secretProvider: SecretProvider = () => ({}), private readonly stepTimeoutMs = 10_000) {}

  async execute(run: Run) {
    if (!run.plan) throw new Error('Run has no test plan')
    const dir = await mkdtemp(join(tmpdir(), 'freebug-run-'))
    const artifacts: Artifact[] = [], results: TestResult[] = [], findings: Finding[] = [], executionLog: unknown[] = []
    const secrets = await this.secretProvider(run)
    const scriptPath = join(dir, 'generated.spec.mjs')
    await writeFile(scriptPath, compilePlaywrightScript(run.plan, run.targetUrl))
    artifacts.push(await this.store.saveFile(run.id, 'script', scriptPath))
    const browser = await chromium.launch({ headless: true })
    const recordingContext = await browser.newContext({ recordVideo: { dir }, baseURL: run.targetUrl })
    const recordingPage = await recordingContext.newPage()
    recordingPage.setDefaultTimeout(this.stepTimeoutMs)

    const runAttempt = async (testCase: TestCase, attempt: number, primary = false): Promise<Attempt> => {
      const context = primary ? recordingContext : await browser.newContext({ baseURL: run.targetUrl })
      await context.tracing.start({ screenshots: true, snapshots: true })
      const page = primary ? recordingPage : await context.newPage(), started = Date.now(), consoleErrors: string[] = [], networkErrors: string[] = [], accessibility: string[] = [], artifactIds: string[] = []
      page.setDefaultTimeout(this.stepTimeoutMs)
      const onConsole = (message:ConsoleMessage) => { if (message.type() === 'error') consoleErrors.push(redact(message.text(), secrets)) }
      const onRequestFailed = (request:PlaywrightRequest) => networkErrors.push(redact(`${request.url()}: ${request.failure()?.errorText ?? 'failed'}`, secrets))
      page.on('console', onConsole); page.on('requestfailed', onRequestFailed)
      let error: string | undefined
      try {
        for (const step of testCase.steps) {
          if (step.action === 'goto') await page.goto(new URL(step.path, run.targetUrl).toString(), { waitUntil: 'domcontentloaded' })
          else if (step.action === 'click') await page.getByRole(step.role, { name: step.name, exact: true }).click()
          else if (step.action === 'fill') await page.getByLabel(step.label, { exact: true }).fill(step.value)
          else if (step.action === 'fillSecret') {
            const value = secrets[step.secretRef]
            if (value === undefined) throw new Error(`Missing configured secret ${step.secretRef}`)
            await page.getByLabel(step.label, { exact: true }).fill(value)
          } else if (step.action === 'assertText') await page.getByText(step.text, { exact: false }).waitFor({ state: 'visible' })
          else if (step.action === 'scanAccessibility') {
            const scan = await new AxeBuilder({ page }).analyze()
            accessibility.push(...scan.violations.filter(item => item.impact === 'critical' || item.impact === 'serious').map(item => `${item.id}: ${item.help}`))
            if (accessibility.length) throw new Error(`Serious accessibility violations: ${accessibility.map(item => item.split(':')[0]).join(', ')}`)
          }
        }
      } catch (cause) {
        error = redact(cause instanceof Error ? cause.message : String(cause), secrets)
        const screenshotPath = join(dir, `${testCase.id}-attempt-${attempt}.png`)
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined)
        const screenshot = await saveIfPresent(this.store, run.id, 'screenshot', screenshotPath, { testId: testCase.id, attempt })
        if (screenshot) { artifacts.push(screenshot); artifactIds.push(screenshot.id) }
      }

      const tracePath = join(dir, `${testCase.id}-attempt-${attempt}-trace.zip`)
      await context.tracing.stop({ path: tracePath })
      page.off('console', onConsole); page.off('requestfailed', onRequestFailed)
      if (!primary) await context.close()
      const trace = await this.store.saveFile(run.id, 'trace', tracePath, { testId: testCase.id, attempt })
      artifacts.push(trace); artifactIds.push(trace.id)
      const result = { error, durationMs: Date.now() - started, consoleErrors, networkErrors, accessibility, artifactIds }
      executionLog.push({ testId: testCase.id, attempt, ...result })
      return result
    }

    try {
      for (const testCase of run.plan.tests) {
        const first = await runAttempt(testCase, 1, true)
        const second = first.error ? await runAttempt(testCase, 2) : undefined
        const classification = classify(first.error, second?.error)
        const error = second?.error ?? first.error
        const artifactIds = [...first.artifactIds, ...(second?.artifactIds ?? [])]
        results.push({ testId: testCase.id, status: first.error ? 'failed' : 'passed', classification, durationMs: first.durationMs + (second?.durationMs ?? 0), error, artifactIds })
        if (first.error) findings.push({
          id: crypto.randomUUID(), testId: testCase.id, title: `Failed: ${testCase.title}`,
          severity: classification === 'confirmed' ? 'high' : 'medium', category: first.accessibility.length ? 'accessibility' : 'functional', classification,
          details: error ?? first.error, expected: expected(testCase), actual: error ?? first.error,
          reproduction: testCase.steps.map(step => JSON.stringify(step)),
          consoleErrors: [...first.consoleErrors, ...(second?.consoleErrors ?? [])], networkErrors: [...first.networkErrors, ...(second?.networkErrors ?? [])], artifactIds,
        })
      }
      const video = recordingPage.video()
      await recordingContext.close()
      const videoPath = await video?.path()
      if (videoPath) {
        const savedVideo = await this.store.saveFile(run.id, 'video', videoPath)
        artifacts.push(savedVideo)
        for (const result of results) result.artifactIds = [...(result.artifactIds ?? []), savedVideo.id]
        for (const finding of findings) finding.artifactIds.push(savedVideo.id)
      }
      const log = await this.store.saveJson(run.id, 'log', 'execution-log.json', executionLog)
      artifacts.push(log)
      return { results, findings, artifacts }
    } finally {
      await browser.close()
      await rm(dir, { recursive: true, force: true })
    }
  }
}

const classify = (first?: string, second?: string): TestResult['classification'] => {
  if (!first) return undefined
  if (!second) return 'flaky'
  return normalize(first) === normalize(second) ? 'confirmed' : 'inconclusive'
}
const normalize = (value: string) => value.replace(/\b\d+(?:\.\d+)?m?s\b/g, '<time>').replace(/\s+/g, ' ').trim()
const expected = (testCase: TestCase) => [...testCase.steps].reverse().find(step => step.action === 'assertText')?.text ?? 'Complete generated Playwright flow without errors'
const redact = (value: string, secrets: Record<string, string>) => Object.values(secrets).filter(Boolean).reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), value)
const saveIfPresent = async (store: ArtifactStore, runId: string, kind: Artifact['kind'], path: string, meta: Partial<Artifact>) => store.saveFile(runId, kind, path, meta).catch(() => undefined)
