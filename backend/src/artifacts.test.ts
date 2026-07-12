import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GcsArtifactStore } from './artifacts.js'

class FakeFile {
  saved?: Buffer
  async save(value: Buffer | string) { this.saved = Buffer.from(value) }
}
class FakeBucket {
  objects = new Map<string, FakeFile>()
  file(name: string) { const file = new FakeFile(); this.objects.set(name, file); return file }
}

describe('GcsArtifactStore', () => {
  it('uploads files and JSON below a run-scoped prefix', async () => {
    const bucket = new FakeBucket()
    const store = new GcsArtifactStore(bucket as never, 'artifacts.example.com')
    const dir = await mkdtemp(join(tmpdir(), 'gcs-test-'))
    try {
      const source = join(dir, 'video.webm'); await writeFile(source, 'video')
      const artifact = await store.saveFile('run-1', 'video', source)
      const report = await store.saveJson('run-1', 'report', 'report.json', { ok: true })
      expect(artifact.url).toMatch(/^https:\/\/artifacts\.example\.com\/runs\/run-1\//)
      expect(report.url).toContain('/runs/run-1/')
      expect([...bucket.objects.keys()].every(name => name.startsWith('runs/run-1/'))).toBe(true)
      expect([...bucket.objects.values()].map(file => file.saved?.toString())).toContain('video')
    } finally { await rm(dir, { recursive: true, force: true }) }
  })

  it('rejects unsafe run identifiers', async () => {
    const store = new GcsArtifactStore(new FakeBucket() as never, 'artifacts.example.com')
    await expect(store.saveJson('../escape', 'report', 'x.json', {})).rejects.toThrow('Invalid run ID')
  })
})
