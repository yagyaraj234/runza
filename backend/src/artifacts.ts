import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import type { Artifact } from './domain.js'
import { Storage } from '@google-cloud/storage'

type BucketLike = { name?: string; file(name: string): { save(value: Buffer | string, options?: unknown): Promise<unknown>; getSignedUrl?(options: unknown): Promise<[string]>; download?():Promise<[Buffer]> } }

export interface ArtifactStore {
  saveFile(runId: string, kind: Artifact['kind'], source: string, meta?: Partial<Artifact>): Promise<Artifact>
  saveJson(runId: string, kind: Artifact['kind'], name: string, value: unknown): Promise<Artifact>
  accessUrl?(artifact: Artifact, expiresSeconds?: number): Promise<{url:string;expiresAt:string}>
  read?(artifact:Artifact):Promise<Buffer>
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

  private artifact(kind: Artifact['kind'], objectKey: string, value: Buffer, meta: Partial<Artifact> = {}): Artifact {
    return { id: randomUUID(), kind, objectKey, size: value.length, sha256: createHash('sha256').update(value).digest('hex'), mimeType: mime(kind), ...meta }
  }
  async saveFile(runId: string, kind: Artifact['kind'], source: string, meta: Partial<Artifact> = {}) {
    const target = this.target(runId, source)
    const value = await readFile(source)
    await this.bucket.file(target.object).save(value, { contentType: mime(kind) })
    return this.artifact(kind, target.object, value, meta)
  }

  async saveJson(runId: string, kind: Artifact['kind'], name: string, value: unknown) {
    const target = this.target(runId, name), body = Buffer.from(JSON.stringify(value, null, 2))
    await this.bucket.file(target.object).save(body, { contentType: 'application/json' })
    return this.artifact(kind, target.object, body, { mimeType: 'application/json' })
  }
  async accessUrl(artifact: Artifact, expiresSeconds = 900) {
    if (!artifact.objectKey) throw new Error('Artifact has no object key')
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000)
    const file = this.bucket.file(artifact.objectKey)
    if (!file.getSignedUrl) throw new Error('Signed URLs are unavailable')
    const [url] = await file.getSignedUrl({ version: 'v4', action: 'read', expires: expiresAt })
    return { url, expiresAt: expiresAt.toISOString() }
  }
  async read(artifact:Artifact){if(!artifact.objectKey)throw new Error('Artifact has no object key');const file=this.bucket.file(artifact.objectKey);if(!file.download)throw new Error('Artifact download unavailable');const [body]=await file.download();return body}
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
  async saveFile(runId: string, kind: Artifact['kind'], source: string, meta: Partial<Artifact> = {}) {
    const target = await this.target(runId, basename(source)); await copyFile(source, target)
    const value = await readFile(target)
    return { ...this.artifact(runId, kind, target), objectKey:target, size: value.length, sha256: createHash('sha256').update(value).digest('hex'), mimeType: mime(kind), ...meta }
  }
  async saveJson(runId: string, kind: Artifact['kind'], name: string, value: unknown) {
    const target = await this.target(runId, name), body = Buffer.from(JSON.stringify(value, null, 2)); await writeFile(target, body)
    return { ...this.artifact(runId, kind, target), objectKey:target, size:body.length, sha256:createHash('sha256').update(body).digest('hex'), mimeType:'application/json' }
  }
  async accessUrl(artifact: Artifact) {
    if (!artifact.url) throw new Error('Artifact URL unavailable')
    return { url: artifact.url, expiresAt: new Date(Date.now() + 900_000).toISOString() }
  }
  async read(artifact:Artifact){if(!artifact.objectKey)throw new Error('Artifact path unavailable');return readFile(artifact.objectKey)}
}

const mime = (kind: Artifact['kind']) => ({ video:'video/webm', screenshot:'image/png', trace:'application/zip', report:'application/json', script:'text/javascript', log:'application/json', manifest:'application/json' })[kind]
