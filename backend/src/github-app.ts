import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

export interface InstallationRepo {
  fullName: string
  private: boolean
  htmlUrl: string
}
export interface PullRequestFile { filename: string; status: string; patch?: string }

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

  async createIssueComment(installationId: string, repoFullName: string, issueNumber: number, body: string): Promise<void> {
    const token = await this.installationToken(installationId)
    await this.api(`/repos/${repoFullName}/issues/${issueNumber}/comments`, token, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    })
  }

  async pullRequestFiles(installationId: string, repoFullName: string, pullRequest: number): Promise<PullRequestFile[]> {
    const token = await this.installationToken(installationId)
    return this.api(`/repos/${repoFullName}/pulls/${pullRequest}/files?per_page=100`, token)
  }

  async createCheckRun(installationId: string, repoFullName: string, headSha: string, detailsUrl: string) {
    const token = await this.installationToken(installationId)
    return this.api<{id:number}>(`/repos/${repoFullName}/check-runs`, token, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Runza PR tests', head_sha: headSha, status: 'in_progress', details_url: detailsUrl, output: { title: 'Runza is preparing tests', summary: 'Inspecting PR changes and staging UI.' } }),
    })
  }

  async updateCheckRun(installationId: string, repoFullName: string, checkRunId: number, input: {conclusion:'success'|'failure'|'neutral'|'action_required';detailsUrl:string;title:string;summary:string}) {
    const token = await this.installationToken(installationId)
    await this.api(`/repos/${repoFullName}/check-runs/${checkRunId}`, token, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed', conclusion: input.conclusion, completed_at: new Date().toISOString(), details_url: input.detailsUrl, output: { title: input.title, summary: input.summary } }),
    })
  }

  async upsertIssueComment(installationId: string, repoFullName: string, issueNumber: number, marker: string, body: string): Promise<void> {
    const token = await this.installationToken(installationId)
    const comments = await this.api<Array<{id:number;body?:string}>>(`/repos/${repoFullName}/issues/${issueNumber}/comments?per_page=100`, token)
    const existing = comments.find(comment => comment.body?.includes(marker))
    await this.api(existing ? `/repos/${repoFullName}/issues/comments/${existing.id}` : `/repos/${repoFullName}/issues/${issueNumber}/comments`, token, {
      method: existing ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: `${marker}\n${body}` }),
    })
  }
}
