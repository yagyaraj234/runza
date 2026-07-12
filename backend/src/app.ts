import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { z } from 'zod'
import type { Config } from './config.js'
import type { EventBus } from './events.js'
import { verifyGitHubSignature, type PullRequestWebhook } from './github.js'
import type { Run } from './domain.js'
import type { RunStore } from './store.js'

const CreateRunSchema = z.object({
  mode: z.enum(['pr', 'discovery']), targetUrl: z.string().url(), repository: z.string().optional(), pullRequest: z.number().int().positive().optional(), email: z.string().email().optional(),
  model: z.object({ baseUrl: z.string().url(), model: z.string().min(1) }).optional(),
})
export function createApp(deps: { config: Config; store: RunStore; events: EventBus }) {
  const app = new Hono(); app.use('*', cors()); app.get('/health', (c) => c.json({ status: 'ok' }))
  app.use('/v1/artifacts/*', serveStatic({ root: resolve(deps.config.ARTIFACT_DIR), rewriteRequestPath: (path) => path.replace(/^\/v1\/artifacts/, '') }))
  const createRun = async (input: z.infer<typeof CreateRunSchema>) => {
    const now = new Date().toISOString(); const run: Run = { id: randomUUID(), mode: input.mode, status: 'queued', targetUrl: input.targetUrl, repository: input.repository, pullRequest: input.pullRequest, email: input.email, model: input.model ?? { baseUrl: deps.config.OPENAI_BASE_URL, model: deps.config.OPENAI_MODEL }, createdAt: now, updatedAt: now }
    await deps.store.create(run); await deps.events.publish({ type: 'run.requested', runId: run.id }); return run
  }
  app.post('/v1/runs', async (c) => {
    const parsed = CreateRunSchema.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    const run = await createRun(parsed.data); return c.json({ run, statusUrl: `${deps.config.PUBLIC_BASE_URL}/v1/runs/${run.id}` }, 202)
  })
  app.get('/v1/runs/:id', async (c) => { const run = await deps.store.get(c.req.param('id')); return run ? c.json({ run }) : c.json({ error: 'not_found' }, 404) })
  app.get('/v1/runs/:id/report', async (c) => { const run = await deps.store.get(c.req.param('id')); if (!run) return c.json({ error: 'not_found' }, 404); return c.json({ run, plan: run.plan, results: run.results ?? [], findings: run.findings ?? [], artifacts: run.artifacts ?? [] }) })
  app.post('/v1/github/webhook', async (c) => {
    const raw = await c.req.text(); if (!verifyGitHubSignature(raw, c.req.header('x-hub-signature-256'), deps.config.GITHUB_WEBHOOK_SECRET)) return c.json({ error: 'invalid_signature' }, 401)
    if (c.req.header('x-github-event') !== 'pull_request') return c.json({ accepted: false, reason: 'ignored_event' })
    const payload = JSON.parse(raw) as PullRequestWebhook; if (!['opened', 'reopened', 'synchronize'].includes(payload.action)) return c.json({ accepted: false, reason: 'ignored_action' })
    const targetUrl = c.req.header('x-freebug-target-url') ?? deps.config.GITHUB_TARGET_URL; if (!targetUrl) return c.json({ error: 'missing_target_url' }, 422)
    const run = await createRun({ mode: 'pr', targetUrl, repository: payload.repository.full_name, pullRequest: payload.pull_request.number })
    return c.json({ accepted: true, runId: run.id, repository: payload.repository.full_name, pullRequest: payload.pull_request.number, statusUrl: `${deps.config.PUBLIC_BASE_URL}/v1/runs/${run.id}` }, 202)
  })
  return app
}
