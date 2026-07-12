import type { Planner } from './planner.js'
import { TestPlanSchema } from './planner.js'
import type { Run, TestPlan, TestCase } from './domain.js'

export class CompositePlanner implements Planner {
  constructor(private readonly planners: Planner[]) {
    if (!planners.length) throw new Error('At least one planner is required')
  }

  async plan(run: Run): Promise<TestPlan> {
    const plans = await Promise.all(this.planners.map(planner => planner.plan(run)))
    const seen = new Set<string>()
    const tests: TestCase[] = []
    plans.forEach((plan, agentIndex) => {
      for (const test of plan.tests) {
        const fingerprint = JSON.stringify(test.steps)
        if (seen.has(fingerprint) || tests.length === 25) continue
        seen.add(fingerprint)
        tests.push({ ...test, id: `agent-${agentIndex + 1}-${test.id}` })
      }
    })
    return TestPlanSchema.parse({ summary: plans.map(plan => plan.summary).join(' | '), tests })
  }
}
