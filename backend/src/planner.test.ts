import { describe, expect, it } from 'vitest'
import { TestPlanSchema } from './planner.js'

describe('TestPlanSchema', () => {
  it('accepts the constrained browser action DSL', () => {
    expect(TestPlanSchema.parse({ summary: 'smoke', tests: [{ id: 'home', title: 'Home', steps: [{ action: 'goto', path: '/' }, { action: 'scanAccessibility' }] }] }).tests).toHaveLength(1)
  })

  it('rejects external navigation and arbitrary executable actions', () => {
    expect(() => TestPlanSchema.parse({ summary: 'unsafe', tests: [{ id: 'unsafe', title: 'Unsafe', steps: [{ action: 'goto', path: 'https://evil.example' }] }] })).toThrow()
    expect(() => TestPlanSchema.parse({ summary: 'unsafe', tests: [{ id: 'unsafe', title: 'Unsafe', steps: [{ action: 'goto', path: '//evil.example' }] }] })).toThrow()
    expect(() => TestPlanSchema.parse({ summary: 'unsafe', tests: [{ id: 'unsafe', title: 'Unsafe', steps: [{ action: 'evaluate', code: 'process.exit()' }] }] })).toThrow()
  })
})
