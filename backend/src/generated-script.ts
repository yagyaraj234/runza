import type { Run } from './domain.js'
import { compilePlaywrightScript } from './playwright-compiler.js'

export function generatePlaywrightScript(run: Run): string {
  if (!run.plan) throw new Error('Run has no test plan')
  return compilePlaywrightScript(run.plan, run.targetUrl)
}
