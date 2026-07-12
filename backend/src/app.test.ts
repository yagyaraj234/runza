import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { InMemoryEventBus } from './events.js'
import { MemoryRunStore } from './store.js'

const config = loadConfig({ GITHUB_WEBHOOK_SECRET: 'test-secret', GITHUB_TARGET_URL: 'https://preview.example.com', PUBLIC_BASE_URL: 'http://localhost:3001', ARTIFACT_DIR: '/tmp' })
const setup = () => {
  const store = new MemoryRunStore(); const events = new InMemoryEventBus()
  return { app: createApp({ config, store, events }), store, events }
}

describe('Freebug API', () => {
  it('reports health', async () => {
    const { app } = setup(); const response = await app.request('/health')
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ status: 'ok' })
  })
  it('creates and publishes a run', async () => {
    const { app, events } = setup(); const seen: string[] = []
    events.subscribe(async (event) => { seen.push(event.runId) })
    const response = await app.request('/v1/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'discovery', targetUrl: 'https://example.com', model: { baseUrl: 'https://models.example/v1', model: 'custom-model' } }) })
    expect(response.status).toBe(202)
    const body = await response.json() as any
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(body.run.model.model).toBe('custom-model'); expect(seen).toEqual([body.run.id])
  })
  it('rejects an invalid GitHub signature', async () => {
    const { app } = setup(); const response = await app.request('/v1/github/webhook', { method: 'POST', headers: { 'x-hub-signature-256': 'sha256=bad' }, body: '{}' })
    expect(response.status).toBe(401)
  })
  it('accepts a signed pull request webhook', async () => {
    const { app } = setup(); const body = JSON.stringify({ action: 'opened', repository: { full_name: 'acme/app' }, pull_request: { number: 7 } })
    const signature = `sha256=${createHmac('sha256', 'test-secret').update(body).digest('hex')}`
    const response = await app.request('/v1/github/webhook', { method: 'POST', headers: { 'x-hub-signature-256': signature, 'x-github-event': 'pull_request' }, body })
    expect(response.status).toBe(202); expect(await response.json()).toMatchObject({ accepted: true, pullRequest: 7 })
  })
})
