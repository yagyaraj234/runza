import { describe, expect, it } from 'vitest'
import type { Planner } from './planner.js'
import { CompositePlanner } from './composite-planner.js'
import type { Run, TestPlan } from './domain.js'

const run = { id: 'r', mode: 'pr', status: 'planning', targetUrl: 'https://example.com', model: { baseUrl: 'https://model.example/v1', model: 'm' }, createdAt: '', updatedAt: '' } as Run
const planner = (plan: TestPlan): Planner => ({ plan: async () => plan })

describe('CompositePlanner', () => {
  it('runs specialists concurrently and deterministically merges unique tests', async () => {
    let active = 0, peak = 0
    const delayed = (plan: TestPlan): Planner => ({ plan: async () => { active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 10)); active--; return plan } })
    const result = await new CompositePlanner([
      delayed({ summary: 'functional', tests: [{ id: 'home', title: 'Home', steps: [{ action: 'goto', path: '/' }] }] }),
      delayed({ summary: 'accessibility', tests: [{ id: 'home', title: 'Home duplicate', steps: [{ action: 'goto', path: '/' }] }, { id: 'a11y', title: 'A11y', steps: [{ action: 'goto', path: '/' }, { action: 'scanAccessibility' }] }] }),
    ]).plan(run)
    expect(peak).toBe(2)
    expect(result.tests.map(test => test.id)).toEqual(['agent-1-home', 'agent-2-a11y'])
    expect(result.summary).toContain('functional')
  })

  it('caps a merged plan at the schema maximum', async () => {
    const tests = Array.from({ length: 20 }, (_, index) => ({ id: `t-${index}`, title: `T ${index}`, steps: [{ action: 'goto' as const, path: `/${index}` }] }))
    const result = await new CompositePlanner([planner({ summary: 'one', tests }), planner({ summary: 'two', tests: tests.map(test => ({ ...test, id: `x-${test.id}`, steps: [{ action: 'goto' as const, path: `/x${test.steps[0].path}` }] })) })]).plan(run)
    expect(result.tests).toHaveLength(25)
  })
})
