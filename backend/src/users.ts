import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export interface User {
  email: string
  name: string
  passwordHash: string
  githubInstallationId?: string
  createdAt: string
}

export interface UserStore {
  create(user: User): Promise<{ created: boolean }>
  getByEmail(email: string): Promise<User | undefined>
  setInstallation(email: string, installationId: string): Promise<void>
  getByInstallation(installationId: string): Promise<User | undefined>
}

export class MemoryUserStore implements UserStore {
  private readonly users = new Map<string, User>()
  async create(user: User) {
    if (this.users.has(user.email)) return { created: false }
    this.users.set(user.email, { ...user })
    return { created: true }
  }
  async getByEmail(email: string) {
    const user = this.users.get(email)
    return user ? { ...user } : undefined
  }
  async setInstallation(email: string, installationId: string) {
    for (const candidate of this.users.values())
      if (candidate.email !== email && candidate.githubInstallationId === installationId) throw new Error('installation_already_linked')
    const user = this.users.get(email)
    if (!user) throw new Error(`User ${email} not found`)
    user.githubInstallationId = installationId
  }
  async getByInstallation(installationId: string) {
    for (const user of this.users.values())
      if (user.githubInstallationId === installationId) return { ...user }
    return undefined
  }
}

export class SqliteUserStore implements UserStore {
  private readonly db: DatabaseSync
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      github_installation_id TEXT,
      created_at TEXT NOT NULL
    ); CREATE UNIQUE INDEX IF NOT EXISTS users_installation_unique ON users(github_installation_id) WHERE github_installation_id IS NOT NULL`)
  }
  private toUser(row: Record<string, unknown> | undefined): User | undefined {
    if (!row) return undefined
    return {
      email: row.email as string,
      name: row.name as string,
      passwordHash: row.password_hash as string,
      githubInstallationId: (row.github_installation_id as string | null) ?? undefined,
      createdAt: row.created_at as string,
    }
  }
  async create(user: User) {
    try {
      this.db.prepare('INSERT INTO users (email, name, password_hash, github_installation_id, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(user.email, user.name, user.passwordHash, user.githubInstallationId ?? null, user.createdAt)
      return { created: true }
    } catch {
      return { created: false }
    }
  }
  async getByEmail(email: string) {
    return this.toUser(this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined)
  }
  async setInstallation(email: string, installationId: string) {
    const owner=this.db.prepare('SELECT email FROM users WHERE github_installation_id = ?').get(installationId) as {email:string}|undefined
    if(owner&&owner.email!==email)throw new Error('installation_already_linked')
    const result = this.db.prepare('UPDATE users SET github_installation_id = ? WHERE email = ?').run(installationId, email)
    if (result.changes === 0) throw new Error(`User ${email} not found`)
  }
  async getByInstallation(installationId: string) {
    return this.toUser(this.db.prepare('SELECT * FROM users WHERE github_installation_id = ?').get(installationId) as Record<string, unknown> | undefined)
  }
}

export class ConvexUserStore implements UserStore {
  constructor(private readonly url: string, private readonly secret: string) {}
  private async call<T>(kind: 'query' | 'mutation', path: string, args: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.url.replace(/\/$/, '')}/api/${kind}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, args: { ...args, secret: this.secret }, format: 'json' }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`Convex returned ${response.status}`)
    const payload = await response.json() as { status: 'success' | 'error'; value?: T; errorMessage?: string }
    if (payload.status !== 'success') throw new Error(payload.errorMessage ?? 'Convex call failed')
    return payload.value as T
  }
  async create(user: User) {
    return this.call<{ created: boolean }>('mutation', 'users:create', { ...user })
  }
  async getByEmail(email: string) {
    return (await this.call<User | null>('query', 'users:getByEmail', { email })) ?? undefined
  }
  async setInstallation(email: string, installationId: string) {
    await this.call('mutation', 'users:setInstallation', { email, installationId })
  }
  async getByInstallation(installationId: string) {
    return (await this.call<User | null>('query', 'users:getByInstallation', { installationId })) ?? undefined
  }
}
