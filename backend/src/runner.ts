import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'
import type { Artifact, Finding, Run, TestResult } from './domain.js'
import type { ArtifactStore } from './artifacts.js'

export interface Executor { execute(run: Run): Promise<{ results: TestResult[]; findings: Finding[]; artifacts: Artifact[] }> }

export class PlaywrightExecutor implements Executor {
  constructor(private readonly store: ArtifactStore) {}
  async execute(run: Run) {
    if (!run.plan) throw new Error('Run has no test plan')
    const dir = await mkdtemp(join(tmpdir(), 'freebug-run-'))
    const browser = await chromium.launch({ headless: true })
    const results: TestResult[] = [], findings: Finding[] = [], artifacts: Artifact[] = []
    try {
      for (const testCase of run.plan.tests) {
        const context = await browser.newContext({ recordVideo: { dir }, baseURL: run.targetUrl })
        await context.tracing.start({ screenshots: true, snapshots: true })
        const page = await context.newPage(); const started = Date.now(); let error: string | undefined
        try {
          for (const step of testCase.steps) {
            if (step.action === 'goto') await page.goto(new URL(step.path, run.targetUrl).toString(), { waitUntil: 'domcontentloaded' })
            else if (step.action === 'click') await page.getByRole(step.role, { name: step.name, exact: true }).click()
            else if (step.action === 'fill') await page.getByLabel(step.label, { exact: true }).fill(step.value)
            else if (step.action === 'assertText') await page.getByText(step.text, { exact: false }).waitFor({ state: 'visible' })
            else if (step.action === 'scanAccessibility') {
              const scan = await new AxeBuilder({ page }).analyze()
              for (const violation of scan.violations) findings.push({ id: randomId(), testId: testCase.id, title: violation.help, severity: impact(violation.impact), details: `${violation.id}: ${violation.description}`, artifactIds: [] })
            }
          }
        } catch (cause) {
          error = cause instanceof Error ? cause.message : String(cause)
          const screenshot = join(dir, `${testCase.id}.png`); await page.screenshot({ path: screenshot, fullPage: true })
          const saved = await this.store.saveFile(run.id, 'screenshot', screenshot); artifacts.push(saved)
          findings.push({ id: randomId(), testId: testCase.id, title: `Failed: ${testCase.title}`, severity: 'high', details: error, artifactIds: [saved.id] })
        }
        const trace = join(dir, `${testCase.id}-trace.zip`); await context.tracing.stop({ path: trace })
        const video = page.video(); await context.close()
        artifacts.push(await this.store.saveFile(run.id, 'trace', trace))
        const videoPath = await video?.path(); if (videoPath) artifacts.push(await this.store.saveFile(run.id, 'video', videoPath))
        results.push({ testId: testCase.id, status: error ? 'failed' : 'passed', durationMs: Date.now() - started, error })
      }
      return { results, findings, artifacts }
    } finally { await browser.close(); await rm(dir, { recursive: true, force: true }) }
  }
}
const randomId = () => crypto.randomUUID()
const impact = (value: string | null | undefined): Finding['severity'] => value === 'critical' || value === 'serious' ? 'high' : value === 'moderate' ? 'medium' : 'low'
