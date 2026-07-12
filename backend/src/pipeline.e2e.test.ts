import { serve, type ServerType } from '@hono/node-server';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { LocalArtifactStore } from './artifacts.js';
import { loadConfig } from './config.js';
import type { Run, TestPlan } from './domain.js';
import { InMemoryEventBus } from './events.js';
import type { Notifier } from './notifier.js';
import { RunPipeline } from './pipeline.js';
import type { Planner } from './planner.js';
import { PlaywrightExecutor } from './runner.js';
import { MemoryRunStore } from './store.js';
import { MemoryUserStore } from './users.js';

const servers: ServerType[] = [];
const directories: string[] = [];
afterEach(async () => {
  for (const server of servers.splice(0))
    await new Promise<void>(resolve => server.close(() => resolve()));
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

const fixture = async () => {
  const app = new Hono();
  app.get('/', c =>
    c.html(
      `<!doctype html><html lang="en"><head><title>Fixture</title></head><body><main><h1>Welcome</h1><button id="start">Start</button><section id="dashboard" hidden><h2>Dashboard</h2></section></main><script>document.querySelector('#start').addEventListener('click',()=>document.querySelector('#dashboard').hidden=false)</script></body></html>`
    )
  );
  return await new Promise<string>(resolve => {
    const server = serve({ fetch: app.fetch, port: 0 }, info =>
      resolve(`http://127.0.0.1:${info.port}`)
    );
    servers.push(server);
  });
};

class FixedPlanner implements Planner {
  async plan(_run: Run): Promise<TestPlan> {
    return {
      summary: 'Exercise the primary user flow',
      tests: [
        {
          id: 'primary-flow',
          title: 'Open dashboard',
          steps: [
            { action: 'goto', path: '/' },
            { action: 'assertText', text: 'Welcome' },
            { action: 'click', role: 'button', name: 'Start' },
            { action: 'assertText', text: 'Dashboard' },
            { action: 'scanAccessibility' },
          ],
        },
      ],
    };
  }
}
class CapturingNotifier implements Notifier {
  runs: Run[] = [];
  async sendCompleted(run: Run) {
    this.runs.push(run);
  }
}
const waitForTerminal = async (store: MemoryRunStore, id: string) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const run = await store.get(id);
    if (run?.status === 'completed' || run?.status === 'failed') return run;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('run did not finish');
};

describe('autonomous testing pipeline', () => {
  it('plans, executes, records evidence, reports, and notifies end to end', async () => {
    const targetUrl = await fixture();
    const artifactDir = await mkdtemp(join(tmpdir(), 'freebug-artifacts-'));
    directories.push(artifactDir);
    const config = loadConfig({
      PUBLIC_BASE_URL: 'http://freebug.test',
      ARTIFACT_DIR: artifactDir,
    });
    const store = new MemoryRunStore(),
      events = new InMemoryEventBus(),
      artifacts = new LocalArtifactStore(artifactDir, config.PUBLIC_BASE_URL),
      notifier = new CapturingNotifier();
    new RunPipeline({
      store,
      events,
      planner: new FixedPlanner(),
      executor: new PlaywrightExecutor(artifacts),
      artifacts,
      notifier,
      publicBaseUrl: config.PUBLIC_BASE_URL,
    }).start();
    const app = createApp({
      config,
      store,
      events,
      users: new MemoryUserStore(),
    });

    const response = await app.request('/v1/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'discovery',
        targetUrl,
        email: 'owner@example.com',
      }),
    });
    expect(response.status).toBe(202);
    const created = (await response.json()) as { run: Run };
    const run = await waitForTerminal(store, created.run.id);

    expect(run.status, run.error).toBe('completed');
    expect(run.results).toEqual([
      expect.objectContaining({ testId: 'primary-flow', status: 'passed' }),
    ]);
    expect(run.artifacts?.map(artifact => artifact.kind)).toEqual(
      expect.arrayContaining(['video', 'trace', 'report'])
    );
    expect(run.reportUrl).toBe(`http://freebug.test/dashboard/runs/${run.id}`);
    expect(notifier.runs).toHaveLength(1);
    expect(notifier.runs[0].email).toBe('owner@example.com');
  }, 30_000);
});
