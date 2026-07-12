import { z } from 'zod'
import type { Run, TestPlan } from './domain.js'

const StepSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('goto'), path: z.string().regex(/^\/(?!\/)/, 'path must be same-origin') }),
  z.object({ action: z.literal('click'), role: z.enum(['button', 'link']), name: z.string().min(1) }),
  z.object({ action: z.literal('fill'), label: z.string().min(1), value: z.string() }),
  z.object({ action: z.literal('fillSecret'), label: z.string().min(1), secretRef: z.string().regex(/^[A-Z][A-Z0-9_]*$/) }),
  z.object({ action: z.literal('assertText'), text: z.string().min(1) }),
  z.object({ action: z.literal('scanAccessibility') }),
])
export const TestPlanSchema = z.object({
  summary: z.string().min(1),
  tests: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1), steps: z.array(StepSchema).min(1).max(30) })).min(1).max(25),
})

export interface Planner { plan(run: Run): Promise<TestPlan> }

export class OpenAIPlanner implements Planner {
  constructor(private readonly apiKey: string, private readonly role = 'functional') {}
  async plan(run: Run): Promise<TestPlan> {
    const response = await fetch(`${run.model.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: run.model.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `Act as ${this.role} testing agent. Create a safe browser test plan as JSON: {summary,tests:[{id,title,steps}]}. Allowed step actions: goto(path same-origin only), click(role button|link,name), fill(label,value), fillSecret(label,secretRef from the allowed list), assertText(text), scanAccessibility. Never emit code, secrets, or external URLs.` },
          { role: 'user', content: JSON.stringify({ mode: run.mode, target: run.targetUrl, repository: run.repository, pullRequest: run.pullRequest, headSha: run.headSha, baseSha: run.baseSha, context: run.planningContext }) },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) throw new Error(`Model endpoint returned ${response.status}`)
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = body.choices?.[0]?.message?.content
    if (!content) throw new Error('Model endpoint returned no plan')
    return TestPlanSchema.parse(JSON.parse(content))
  }
}

export class MultiAgentPlanner implements Planner {
  private readonly planners: OpenAIPlanner[]
  constructor(apiKey: string, roles: string[]) {
    this.planners = roles.filter(Boolean).map((role) => new OpenAIPlanner(apiKey, role))
    if (!this.planners.length) throw new Error('PLANNER_AGENTS must contain at least one role')
  }
  async plan(run: Run): Promise<TestPlan> {
    const plans = await Promise.all(this.planners.map((planner) => planner.plan(run)))
    return TestPlanSchema.parse({
      summary: plans.map((plan) => plan.summary).join(' | '),
      tests: plans.flatMap((plan, agent) => plan.tests.map((test) => ({ ...test, id: `a${agent + 1}-${test.id}` }))).slice(0, 25),
    })
  }
}
