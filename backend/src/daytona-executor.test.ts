import { describe, expect, it } from 'vitest'
import type { ArtifactStore } from './artifacts.js'
import { DaytonaExecutor, type DaytonaClientLike } from './daytona-executor.js'
import type { Artifact, Run } from './domain.js'

class CaptureStore implements ArtifactStore {
  artifacts: Artifact[] = []
  async saveFile(runId: string, kind: Artifact['kind'], source: string) { const artifact = { id: `${kind}-${this.artifacts.length}`, kind, url: `stored://${runId}/${source.split('/').pop()}` }; this.artifacts.push(artifact); return artifact }
  async saveJson(runId: string, kind: Artifact['kind'], name: string) { const artifact = { id: `${kind}-${this.artifacts.length}`, kind, url: `stored://${runId}/${name}` }; this.artifacts.push(artifact); return artifact }
}

const run = { id: 'run-1', mode: 'pr', status: 'running', targetUrl: 'https://example.com', model: { baseUrl: 'https://models.example/v1', model: 'm' }, plan: { summary: 'smoke', tests: [{ id: 'home', title: 'Home', steps: [{ action: 'goto', path: '/' }] }] }, createdAt: '', updatedAt: '' } as Run

describe('DaytonaExecutor', () => {
  it('uploads and executes a generated script, downloads evidence, and deletes the sandbox', async () => {
    const remote = new Map<string, Buffer>()
    let deleted = false
    const sandbox = {
      fs: {
        uploadFile: async (data: Buffer, path: string) => { remote.set(path, Buffer.from(data)) },
        downloadFile: async (path: string) => remote.get(path) ?? (() => { throw new Error(`missing ${path}`) })(),
      },
      process: { executeCommand: async () => {
        remote.set('/workspace/freebug/results.json', Buffer.from(JSON.stringify({ results: [{ testId: 'home', status: 'passed', durationMs: 10 }], findings: [], files: [{ kind: 'video', path: '/workspace/freebug/evidence/home.webm' }, { kind: 'trace', path: '/workspace/freebug/evidence/home.zip' }] })))
        remote.set('/workspace/freebug/evidence/home.webm', Buffer.from('video'))
        remote.set('/workspace/freebug/evidence/home.zip', Buffer.from('trace'))
        return { exitCode: 0, result: 'ok' }
      } },
      delete: async () => { deleted = true },
    }
    const client: DaytonaClientLike = { create: async () => sandbox }
    const store = new CaptureStore()
    const output = await new DaytonaExecutor(client, store, { snapshot: 'playwright', timeoutSeconds: 120 }).execute(run)
    expect(remote.get('/workspace/freebug/test.mjs')?.toString()).toContain('recordVideo')
    expect(output.results).toEqual([{ testId: 'home', status: 'passed', durationMs: 10 }])
    expect(output.artifacts.map(a => a.kind)).toEqual(['script', 'video', 'trace'])
    expect(deleted).toBe(true)
  })

  it('always deletes the sandbox after command failure', async () => {
    let deleted = false
    const client: DaytonaClientLike = { create: async () => ({ fs: { uploadFile: async () => {}, downloadFile: async () => Buffer.from('') }, process: { executeCommand: async () => ({ exitCode: 1, result: 'boom' }) }, delete: async () => { deleted = true } }) }
    await expect(new DaytonaExecutor(client, new CaptureStore(), { timeoutSeconds: 10 }).execute(run)).rejects.toThrow('boom')
    expect(deleted).toBe(true)
  })
})
