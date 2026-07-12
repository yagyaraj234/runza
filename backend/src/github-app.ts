import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

export interface InstallationRepo {
  fullName: string
  private: boolean
  htmlUrl: string
}

const GITHUB_API = 'https://api.github.com'
const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

export class GitHubApp {
  private readonly privateKey: string
  constructor(private readonly appId: string, privateKeyPath: string, readonly slug: string) {
    this.privateKey = privateKeyPath ? readFileSync(privateKeyPath, 'utf8') : ''
  }

  get configured(): boolean {
    return Boolean(this.appId && this.privateKey && this.slug)
  }

  get installUrl(): string {
    return `https://github.com/apps/${this.slug}/installations/new`
  }

  private appJwt(): string {
    const now = Math.floor(Date.now() / 1000)
    const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({ iat: now - 60, exp: now + 540, iss: this.appId })}`
    const signature = createSign('RSA-SHA256').update(unsigned).sign(this.privateKey, 'base64url')
    return `${unsigned}.${signature}`
  }

  private async api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${GITHUB_API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'freebug', ...init.headers },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`GitHub returned ${response.status} for ${path}`)
    return response.json() as Promise<T>
  }

  async installationToken(installationId: string): Promise<string> {
    const result = await this.api<{ token: string }>(`/app/installations/${installationId}/access_tokens`, this.appJwt(), { method: 'POST' })
    return result.token
  }

  async listInstallations(): Promise<Array<{ id: number; account: string }>> {
    const result = await this.api<Array<{ id: number; account: { login: string } | null }>>(
      '/app/installations?per_page=100', this.appJwt()
    )
    return result.map(installation => ({ id: installation.id, account: installation.account?.login ?? 'unknown' }))
  }

  async listRepos(installationId: string): Promise<InstallationRepo[]> {
    const token = await this.installationToken(installationId)
    const result = await this.api<{ repositories: Array<{ full_name: string; private: boolean; html_url: string }> }>(
      '/installation/repositories?per_page=100', token
    )
    return result.repositories.map(repo => ({ fullName: repo.full_name, private: repo.private, htmlUrl: repo.html_url }))
  }
}
