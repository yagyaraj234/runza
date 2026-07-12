import { z } from 'zod'
import type { Run, TestPlan } from './domain.js'

const StepSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('goto'), path: z.string().regex(/^\/(?!\/)/, 'path must be same-origin') }),
  z.object({ action: z.literal('click'), role: z.enum(['button', 'link']), name: z.string().min(1) }),
  z.object({ action: z.literal('fill'), label: z.string().min(1), value: z.string() }),
  z.object({ action: z.literal('assertText'), text: z.string().min(1) }),
  z.object({ action: z.literal('scanAccessibility') }),
])
export const TestPlanSchema = z.object({
  summary: z.string().min(1),
  tests: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1), steps: z.array(StepSchema).min(1).max(30) })).min(1).max(25),
})

export interface Planner { plan(run: Run): Promise<TestPlan> }

export class OpenAIPlanner implements Planner {
  constructor(private readonly apiKey: string) {}
  async plan(run: Run): Promise<TestPlan> {
    const response = await fetch(`${run.model.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: run.model.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Create a safe browser test plan as JSON: {summary,tests:[{id,title,steps}]}. Allowed step actions: goto(path same-origin only), click(role button|link,name), fill(label,value), assertText(text), scanAccessibility. Never emit code or external URLs.' },
          { role: 'user', content: `Mode: ${run.mode}. Target: ${run.targetUrl}. Repository: ${run.repository ?? 'not supplied'}. Pull request: ${run.pullRequest ?? 'not supplied'}.` },
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
