import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Run } from './domain.js'

export type ReportVisibility = 'private' | 'public'
export type LoginStep =
  | { action: 'fillSecret'; label: string; secretRef: string }
  | { action: 'click'; role: 'button' | 'link'; name: string }
  | { action: 'assertText'; text: string }
export interface RepositorySettings {
  repository: string
  installationId: string
  ownerEmail: string
  previewUrl: string
  enabled: boolean
  reportVisibility: ReportVisibility
  loginPath?: string
  loginSteps: LoginStep[]
}

export interface RunStore {
  create(run: Run): Promise<void>
  get(id: string): Promise<Run | undefined>
  update(id: string, patch: Partial<Run>): Promise<Run>
  listByEmail(email: string): Promise<Run[]>
  claimDelivery(deliveryId: string): Promise<boolean>
}

export class MemoryRunStore implements RunStore {
  private readonly runs = new Map<string, Run>()
  private readonly deliveries = new Set<string>()
  async create(run: Run) { this.runs.set(run.id, structuredClone(run)) }
  async get(id: string) { const run = this.runs.get(id); return run ? structuredClone(run) : undefined }
  async listByEmail(email: string) {
    return [...this.runs.values()]
      .filter(run => run.email === email)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(run => structuredClone(run))
  }
  async update(id: string, patch: Partial<Run>) {
    const current = this.runs.get(id)
    if (!current) throw new Error(`Run ${id} not found`)
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() }
    this.runs.set(id, updated)
    return structuredClone(updated)
  }
  async claimDelivery(deliveryId: string) {
    if (this.deliveries.has(deliveryId)) return false
    this.deliveries.add(deliveryId)
    return true
  }
}

export class SqliteRunStore implements RunStore {
  private readonly db: DatabaseSync
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        email TEXT,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS runs_email_created ON runs(email, created_at DESC);
      CREATE TABLE IF NOT EXISTS github_deliveries (
        id TEXT PRIMARY KEY,
        received_at TEXT NOT NULL
      );
    `)
    this.db.prepare('DELETE FROM runs WHERE created_at < ?').run(new Date(Date.now()-30*24*60*60*1000).toISOString())
    const active = ['queued','scanning','planning','running','confirming','uploading','reporting']
    for (const row of this.db.prepare('SELECT id, data FROM runs').all() as Array<{id:string;data:string}>) {
      const run = JSON.parse(row.data) as Run
      if (!active.includes(run.status)) continue
      const at = new Date().toISOString()
      const updated = { ...run, status: 'failed' as const, error: 'Backend restarted during run', updatedAt: at, events: [...(run.events ?? []), { status: 'failed' as const, at, message: 'Backend restarted during run' }] }
      this.write(updated)
    }
  }
  private write(run: Run) {
    this.db.prepare(`INSERT INTO runs (id,email,created_at,data) VALUES (?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET email=excluded.email, created_at=excluded.created_at, data=excluded.data`)
      .run(run.id, run.email ?? null, run.createdAt, JSON.stringify(run))
  }
  async create(run: Run) { this.write(structuredClone(run)) }
  async get(id: string) {
    const row = this.db.prepare('SELECT data FROM runs WHERE id = ?').get(id) as {data:string}|undefined
    return row ? JSON.parse(row.data) as Run : undefined
  }
  async listByEmail(email: string) {
    return (this.db.prepare('SELECT data FROM runs WHERE email = ? ORDER BY created_at DESC').all(email) as Array<{data:string}>).map(row => JSON.parse(row.data) as Run)
  }
  async update(id: string, patch: Partial<Run>) {
    const current = await this.get(id)
    if (!current) throw new Error(`Run ${id} not found`)
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() }
    this.write(updated)
    return structuredClone(updated)
  }
  async claimDelivery(deliveryId: string) {
    try { this.db.prepare('INSERT INTO github_deliveries (id,received_at) VALUES (?,?)').run(deliveryId, new Date().toISOString()); return true }
    catch { return false }
  }
}

export class RepositoryStore {
  private readonly db: DatabaseSync
  private readonly key: Buffer
  constructor(path: string, encryptionKey: string) {
    mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;')
    this.key = Buffer.from(encryptionKey, 'base64')
    if (this.key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32-byte base64')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS repository_settings (
        repository TEXT PRIMARY KEY,
        installation_id TEXT NOT NULL,
        owner_email TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS repository_secrets (
        repository TEXT NOT NULL,
        name TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        PRIMARY KEY(repository,name)
      );
    `)
  }
  get(repository: string): RepositorySettings | undefined {
    const row = this.db.prepare('SELECT data FROM repository_settings WHERE repository = ?').get(repository) as {data:string}|undefined
    return row ? JSON.parse(row.data) as RepositorySettings : undefined
  }
  save(settings: RepositorySettings) {
    this.db.prepare(`INSERT INTO repository_settings (repository,installation_id,owner_email,data) VALUES (?,?,?,?)
      ON CONFLICT(repository) DO UPDATE SET installation_id=excluded.installation_id,owner_email=excluded.owner_email,data=excluded.data`)
      .run(settings.repository, settings.installationId, settings.ownerEmail, JSON.stringify(settings))
    return settings
  }
  private encrypt(value: string) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
  }
  private decrypt(value: string) {
    const packed = Buffer.from(value, 'base64'), iv = packed.subarray(0,12), tag = packed.subarray(12,28)
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv); decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8')
  }
  setSecret(repository: string, name: string, value: string) {
    this.db.prepare(`INSERT INTO repository_secrets (repository,name,ciphertext) VALUES (?,?,?)
      ON CONFLICT(repository,name) DO UPDATE SET ciphertext=excluded.ciphertext`).run(repository, name, this.encrypt(value))
  }
  deleteSecret(repository: string, name: string) { this.db.prepare('DELETE FROM repository_secrets WHERE repository = ? AND name = ?').run(repository,name) }
  secretNames(repository: string) { return (this.db.prepare('SELECT name FROM repository_secrets WHERE repository = ? ORDER BY name').all(repository) as Array<{name:string}>).map(row=>row.name) }
  secrets(repository: string) {
    return Object.fromEntries((this.db.prepare('SELECT name,ciphertext FROM repository_secrets WHERE repository = ?').all(repository) as Array<{name:string;ciphertext:string}>).map(row=>[row.name,this.decrypt(row.ciphertext)]))
  }
}
