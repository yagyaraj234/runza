import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Artifact } from './domain.js'
import { Storage } from '@google-cloud/storage'

type BucketLike = { name?: string; file(name: string): { save(value: Buffer | string, options?: unknown): Promise<unknown> } }

export interface ArtifactStore {
  saveFile(runId: string, kind: Artifact['kind'], source: string): Promise<Artifact>
  saveJson(runId: string, kind: Artifact['kind'], name: string, value: unknown): Promise<Artifact>
}

export class GcsArtifactStore implements ArtifactStore {
  private readonly bucket: BucketLike
  private readonly prefix: string
  private readonly publicBaseUrl?: string

  constructor(bucket: string, prefix?: string, publicBaseUrl?: string)
  constructor(bucket: BucketLike, publicBaseUrl?: string)
  constructor(bucket: string | BucketLike, second = 'runs', third?: string) {
    if (typeof bucket === 'string') {
      this.bucket = new Storage().bucket(bucket)
      this.prefix = second || 'runs'
      this.publicBaseUrl = third
    } else {
      this.bucket = bucket
      this.prefix = 'runs'
      this.publicBaseUrl = second ? `https://${second.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : undefined
    }
  }

  private target(runId: string, name: string) {
    if (!/^[A-Za-z0-9_-]+$/.test(runId)) throw new Error('Invalid run ID')
    const object = `${this.prefix.replace(/^\/+|\/+$/g, '')}/${runId}/${randomUUID()}-${basename(name)}`
    const base = this.publicBaseUrl?.replace(/\/$/, '')
    const url = base ? `${base}/${object}` : `gs://${this.bucket.name ?? 'bucket'}/${object}`
    return { object, url }
  }

  async saveFile(runId: string, kind: Artifact['kind'], source: string) {
    const target = this.target(runId, source)
    await this.bucket.file(target.object).save(await readFile(source))
    return { id: randomUUID(), kind, url: target.url }
  }

  async saveJson(runId: string, kind: Artifact['kind'], name: string, value: unknown) {
    const target = this.target(runId, name)
    await this.bucket.file(target.object).save(JSON.stringify(value, null, 2), { contentType: 'application/json' })
    return { id: randomUUID(), kind, url: target.url }
  }
}

export class LocalArtifactStore implements ArtifactStore {
  constructor(private readonly root: string, private readonly publicBaseUrl: string) {}
  private async target(runId: string, name: string) {
    const dir = join(this.root, runId); await mkdir(dir, { recursive: true })
    return join(dir, `${randomUUID()}-${basename(name)}`)
  }
  private artifact(runId: string, kind: Artifact['kind'], target: string): Artifact {
    const name = basename(target)
    return { id: randomUUID(), kind, url: `${this.publicBaseUrl.replace(/\/$/, '')}/v1/artifacts/${runId}/${name}` }
  }
  async saveFile(runId: string, kind: Artifact['kind'], source: string) {
    const target = await this.target(runId, basename(source)); await copyFile(source, target)
    return this.artifact(runId, kind, target)
  }
  async saveJson(runId: string, kind: Artifact['kind'], name: string, value: unknown) {
    const target = await this.target(runId, name); await writeFile(target, JSON.stringify(value, null, 2))
    return this.artifact(runId, kind, target)
  }
}
