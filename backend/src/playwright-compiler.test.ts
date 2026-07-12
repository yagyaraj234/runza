import { describe, expect, it } from 'vitest'
import { compilePlaywrightScript } from './playwright-compiler.js'

describe('compilePlaywrightScript', () => {
  it('compiles every constrained DSL action and records evidence', () => {
    const script = compilePlaywrightScript({ summary: 'all', tests: [{ id: 'quoted', title: 'Quotes', steps: [
      { action: 'goto', path: '/' },
      { action: 'click', role: 'button', name: `Say 'hello'` },
      { action: 'fill', label: 'Email', value: 'a@example.com' },
      { action: 'assertText', text: 'Welcome' },
      { action: 'scanAccessibility' },
    ] }] }, 'https://example.com')
    expect(script).toContain("import { chromium } from 'playwright'")
    expect(script).toContain("import { AxeBuilder } from '@axe-core/playwright'")
    expect(script).toContain('recordVideo')
    expect(script).toContain('tracing.start')
    expect(script).toContain('page.getByRole(step.role')
    expect(script).toContain(JSON.stringify(`Say 'hello'`))
    expect(script).toContain('results.json')
  })

  it('serializes text as data instead of executable source', () => {
    const attack = `'); process.exit(1); //`
    const script = compilePlaywrightScript({ summary: 'safe', tests: [{ id: 'safe', title: 'Safe', steps: [{ action: 'assertText', text: attack }] }] }, 'https://example.com')
    expect(script).toContain(JSON.stringify(attack))
    expect(script).not.toContain(`getByText('${attack}')`)
  })
})
