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
const results = [], findings = [], files = [], executionLog = []
const recordingContext = await browser.newContext({ recordVideo: { dir: output }, baseURL: input.targetUrl })
const recordingPage = await recordingContext.newPage()

async function runAttempt(test, attempt, primary = false) {
  const context = primary ? recordingContext : await browser.newContext({ baseURL: input.targetUrl })
  await context.tracing.start({ screenshots: true, snapshots: true })
  const page = primary ? recordingPage : await context.newPage(), started = Date.now(), consoleErrors = [], networkErrors = []
  const onConsole = message => { if (message.type() === 'error') consoleErrors.push(message.text()) }
  const onRequestFailed = request => networkErrors.push(request.url() + ': ' + (request.failure()?.errorText ?? 'failed'))
  page.on('console', onConsole); page.on('requestfailed', onRequestFailed)
  let error, accessibility = []
  try {
    for (const step of test.steps) {
      if (step.action === 'goto') await page.goto(new URL(step.path, input.targetUrl).toString(), { waitUntil: 'domcontentloaded' })
      else if (step.action === 'click') await page.getByRole(step.role, { name: step.name, exact: true }).click()
      else if (step.action === 'fill') await page.getByLabel(step.label, { exact: true }).fill(step.value)
      else if (step.action === 'fillSecret') {
        const value = process.env[step.secretRef]
        if (value === undefined) throw new Error('Missing configured secret ' + step.secretRef)
        await page.getByLabel(step.label, { exact: true }).fill(value)
      } else if (step.action === 'assertText') await page.getByText(step.text, { exact: false }).waitFor({ state: 'visible' })
      else if (step.action === 'scanAccessibility') {
        const scan = await new AxeBuilder({ page }).analyze()
        accessibility = scan.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
        if (accessibility.length) throw new Error('Serious accessibility violations: ' + accessibility.map(v => v.id).join(', '))
      }
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause)
    const screenshot = output + '/' + test.id + '-attempt-' + attempt + '.png'
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined)
    files.push({ kind: 'screenshot', path: screenshot, testId: test.id, attempt })
  }
  const trace = output + '/' + test.id + '-attempt-' + attempt + '-trace.zip'
  await context.tracing.stop({ path: trace })
  page.off('console', onConsole); page.off('requestfailed', onRequestFailed)
  if (!primary) await context.close()
  files.push({ kind: 'trace', path: trace, testId: test.id, attempt })
  const detail = { error, durationMs: Date.now() - started, consoleErrors, networkErrors, accessibility }
  executionLog.push({ testId: test.id, attempt, ...detail })
  return detail
}

try {
  for (const test of input.tests) {
    const first = await runAttempt(test, 1, true)
    const second = first.error ? await runAttempt(test, 2) : undefined
    const classification = !first.error ? undefined : second?.error ? (second.error === first.error ? 'confirmed' : 'inconclusive') : 'flaky'
    const error = second?.error ?? first.error
    results.push({ testId: test.id, status: first.error ? 'failed' : 'passed', classification, durationMs: first.durationMs + (second?.durationMs ?? 0), ...(error ? { error } : {}) })
    if (first.error) findings.push({ id: crypto.randomUUID(), testId: test.id, title: 'Failed: ' + test.title, severity: classification === 'confirmed' ? 'high' : 'medium', category: first.accessibility.length ? 'accessibility' : 'functional', classification, details: error, expected: 'Complete generated Playwright flow without errors', actual: error, reproduction: test.steps.map(step => JSON.stringify(step)), consoleErrors: [...first.consoleErrors, ...(second?.consoleErrors ?? [])], networkErrors: [...first.networkErrors, ...(second?.networkErrors ?? [])], artifactIds: [] })
  }
} finally {
  const video = recordingPage.video()
  await recordingContext.close()
  const videoPath = await video?.path(); if (videoPath) files.push({ kind: 'video', path: videoPath })
  await browser.close()
}
const logPath = output + '/execution-log.json'
await writeFile(logPath, JSON.stringify(executionLog, null, 2)); files.push({ kind: 'log', path: logPath })
await writeFile('/workspace/freebug/results.json', JSON.stringify({ results, findings, files }, null, 2))
`
}
