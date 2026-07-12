import type { TestPlan } from './domain.js'

export function compilePlaywrightScript(plan: TestPlan, targetUrl: string): string {
  const input = JSON.stringify({ targetUrl, tests: plan.tests })
  return `import { chromium } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'
import { mkdir, writeFile } from 'node:fs/promises'

const input = ${input}
const output = '/workspace/freebug/evidence'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = [], findings = [], files = []
try {
  for (const test of input.tests) {
    const context = await browser.newContext({ recordVideo: { dir: output }, baseURL: input.targetUrl })
    await context.tracing.start({ screenshots: true, snapshots: true })
    const page = await context.newPage(), started = Date.now()
    let error
    try {
      for (const step of test.steps) {
        if (step.action === 'goto') await page.goto(new URL(step.path, input.targetUrl).toString(), { waitUntil: 'domcontentloaded' })
        else if (step.action === 'click') await page.getByRole(step.role, { name: step.name, exact: true }).click()
        else if (step.action === 'fill') await page.getByLabel(step.label, { exact: true }).fill(step.value)
        else if (step.action === 'assertText') await page.getByText(step.text, { exact: false }).waitFor({ state: 'visible' })
        else if (step.action === 'scanAccessibility') {
          const scan = await new AxeBuilder({ page }).analyze()
          for (const violation of scan.violations) findings.push({ id: crypto.randomUUID(), testId: test.id, title: violation.help, severity: violation.impact === 'critical' || violation.impact === 'serious' ? 'high' : violation.impact === 'moderate' ? 'medium' : 'low', details: violation.id + ': ' + violation.description, artifactIds: [] })
        }
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
      const screenshot = output + '/' + test.id + '.png'
      await page.screenshot({ path: screenshot, fullPage: true })
      files.push({ kind: 'screenshot', path: screenshot })
      findings.push({ id: crypto.randomUUID(), testId: test.id, title: 'Failed: ' + test.title, severity: 'high', details: error, artifactIds: [] })
    }
    const trace = output + '/' + test.id + '-trace.zip'
    await context.tracing.stop({ path: trace })
    const video = page.video()
    await context.close()
    files.push({ kind: 'trace', path: trace })
    const videoPath = await video?.path()
    if (videoPath) files.push({ kind: 'video', path: videoPath })
    results.push({ testId: test.id, status: error ? 'failed' : 'passed', durationMs: Date.now() - started, ...(error ? { error } : {}) })
  }
} finally { await browser.close() }
await writeFile('/workspace/freebug/results.json', JSON.stringify({ results, findings, files }, null, 2))
`
}
