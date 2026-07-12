import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { InMemoryEventBus } from './events.js';
import { MemoryRunStore } from './store.js';
import { MemoryUserStore } from './users.js';

const config = loadConfig({
  GITHUB_WEBHOOK_SECRET: 'test-secret',
  GITHUB_TARGET_URL: 'https://preview.example.com',
  PUBLIC_BASE_URL: 'http://localhost:3001',
  ARTIFACT_DIR: '/tmp',
});
const setup = () => {
  const store = new MemoryRunStore();
  const events = new InMemoryEventBus();
  return {
    app: createApp({ config, store, events, users: new MemoryUserStore() }),
    store,
    events,
  };
};
const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('Freebug API', () => {
  it('reports health', async () => {
    const { app } = setup();
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
  it('creates and publishes a run', async () => {
    const { app, events } = setup();
    const seen: string[] = [];
    events.subscribe(async event => {
      seen.push(event.runId);
    });
    const response = await app.request('/v1/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'discovery',
        targetUrl: 'https://example.com',
        model: { baseUrl: 'https://models.example/v1', model: 'custom-model' },
      }),
    });
    expect(response.status).toBe(202);
    const body = (await response.json()) as any;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(body.run.model.model).toBe('custom-model');
    expect(seen).toEqual([body.run.id]);
  });
  it('signs up, logs in, and rejects bad credentials', async () => {
    const { app } = setup();
    const signup = await app.request(
      '/v1/auth/signup',
      json({
        name: 'Ada',
        email: ' Person@Example.COM ',
        password: 'password123',
      })
    );
    expect(signup.status).toBe(201);
    const created = (await signup.json()) as any;
    expect(created.user).toEqual({
      email: 'person@example.com',
      name: 'Ada',
      githubInstallationId: null,
    });
    expect(typeof created.token).toBe('string');

    const duplicate = await app.request(
      '/v1/auth/signup',
      json({
        name: 'Ada',
        email: 'person@example.com',
        password: 'password123',
      })
    );
    expect(duplicate.status).toBe(409);

    const login = await app.request(
      '/v1/auth/login',
      json({ email: 'person@example.com', password: 'password123' })
    );
    expect(login.status).toBe(200);
    const { token } = (await login.json()) as any;

    const me = await app.request('/v1/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);
    expect(((await me.json()) as any).user.email).toBe('person@example.com');

    const bad = await app.request(
      '/v1/auth/login',
      json({ email: 'person@example.com', password: 'wrong-password' })
    );
    expect(bad.status).toBe(401);
    const anon = await app.request('/v1/auth/me');
    expect(anon.status).toBe(401);
  });

  it('rejects an invalid GitHub signature', async () => {
    const { app } = setup();
    const response = await app.request('/v1/github/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': 'sha256=bad' },
      body: '{}',
    });
    expect(response.status).toBe(401);
  });
  it('accepts a signed pull request webhook with PR metadata and deduplicates its delivery', async () => {
    const { app, events } = setup();
    const seen: string[] = [];
    events.subscribe(async event => {
      seen.push(event.runId);
    });
    const body = JSON.stringify({
      action: 'opened',
      repository: { full_name: 'acme/app' },
      pull_request: {
        number: 7,
        head: { sha: 'head-sha' },
        base: { sha: 'base-sha' },
      },
    });
    const signature = `sha256=${createHmac('sha256', 'test-secret').update(body).digest('hex')}`;
    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'delivery-1',
    };
    const response = await app.request('/v1/github/webhook', {
      method: 'POST',
      headers,
      body,
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      accepted: true,
      pullRequest: 7,
    });
    const duplicate = await app.request('/v1/github/webhook', {
      method: 'POST',
      headers,
      body,
    });
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({
      accepted: false,
      reason: 'duplicate_delivery',
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(seen).toHaveLength(1);
  });
});
