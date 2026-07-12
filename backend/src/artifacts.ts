import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Artifact } from './domain.js'

export interface ArtifactStore {
  saveFile(runId: string, kind: Artifact['kind'], source: string): Promise<Artifact>
  saveJson(runId: string, kind: Artifact['kind'], name: string, value: unknown): Promise<Artifact>
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
