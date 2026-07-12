import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'

export const apiBase = ((import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '')

export interface AuthUser {
  email: string
  name: string
  githubInstallationId: string | null
}

export interface Repo {
  fullName: string
  private: boolean
  htmlUrl: string
}

export interface Run {
  id: string
  mode: 'pr' | 'discovery'
  status: string
  targetUrl: string
  repository?: string
  pullRequest?: number
  createdAt: string
  updatedAt?: string
  headSha?: string
  targetFingerprint?: string
  error?: string
  events?: Array<{status:string;at:string;message?:string}>
}
export interface TestCase{ id:string;title:string;steps:Array<Record<string,unknown>> }
export interface TestResult{testId:string;status:'passed'|'failed';classification?:'confirmed'|'flaky'|'inconclusive';durationMs:number;error?:string;artifactIds?:string[]}
export interface Finding{id:string;testId:string;title:string;severity:string;category?:string;classification?:'confirmed'|'flaky'|'inconclusive';details:string;expected?:string;actual?:string;reproduction?:string[];consoleErrors?:string[];networkErrors?:string[];repairPrompt?:string;artifactIds:string[]}
export interface Artifact{id:string;kind:'video'|'screenshot'|'trace'|'report'|'script'|'log'|'manifest';testId?:string;attempt?:number;mimeType?:string;size?:number;sha256?:string}
export interface RunReport{run:Run&{plan?:{summary:string;tests:TestCase[]};results?:TestResult[];findings?:Finding[];artifacts?:Artifact[]};plan?:{summary:string;tests:TestCase[]};results:TestResult[];findings:Finding[];artifacts:Artifact[]}
export interface RepositorySettings{repository:string;previewUrl:string;enabled:boolean;reportVisibility:'private'|'public';loginPath?:string;loginSteps:Array<Record<string,string>>;secretNames:string[]}

const TOKEN_KEY = 'auth_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const logout = () => localStorage.removeItem(TOKEN_KEY)

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code) }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, (body as { error?: string }).error ?? 'request_failed')
  return body as T
}

async function authenticate(path: string, payload: object): Promise<AuthUser> {
  const { token, user } = await request<{ token: string; user: AuthUser }>(path, { method: 'POST', body: JSON.stringify(payload) })
  localStorage.setItem(TOKEN_KEY, token)
  return user
}

export const signup = (name: string, email: string, password: string) =>
  authenticate('/v1/auth/signup', { name, email, password })

export const login = (email: string, password: string) =>
  authenticate('/v1/auth/login', { email, password })

export async function me(): Promise<AuthUser | null> {
  if (!getToken()) return null
  try {
    return (await request<{ user: AuthUser }>('/v1/auth/me')).user
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) logout()
    return null
  }
}

export const githubInstallUrl = async () =>
  (await request<{ installUrl: string }>('/v1/github/app')).installUrl

export const saveInstallation = (installationId: string) =>
  request('/v1/github/installation', { method: 'POST', body: JSON.stringify({ installationId }) })

export const listRepos = async () => (await request<{ repos: Repo[] }>('/v1/github/repos')).repos

export interface Installation {
  id: number
  account: string
}

export const listInstallations = async () =>
  (await request<{ installations: Installation[] }>('/v1/github/installations')).installations

export const listRuns = async () => (await request<{ runs: Run[] }>('/v1/runs')).runs
const repoPath=(repository:string)=>repository.split('/').map(encodeURIComponent).join('/')
export const getRepositorySettings=async(repository:string)=>(await request<{settings:RepositorySettings|null}>(`/v1/repos/${repoPath(repository)}/settings`)).settings
export const saveRepositorySettings=(repository:string,settings:Omit<RepositorySettings,'repository'|'secretNames'>)=>request<{settings:RepositorySettings}>(`/v1/repos/${repoPath(repository)}/settings`,{method:'PUT',body:JSON.stringify(settings)})
export const saveRepositorySecret=(repository:string,name:string,value:string)=>request(`/v1/repos/${repoPath(repository)}/secrets/${encodeURIComponent(name)}`,{method:'PUT',body:JSON.stringify({value})})
export const deleteRepositorySecret=(repository:string,name:string)=>request(`/v1/repos/${repoPath(repository)}/secrets/${encodeURIComponent(name)}`,{method:'DELETE'})
export const verifyRepository=(repository:string)=>request<{verified:boolean;error?:string}>(`/v1/repos/${repoPath(repository)}/settings/verify`,{method:'POST'})
export const getRunReport=(id:string)=>request<RunReport>(`/v1/runs/${id}/report`)
export const getSharedReport=async(token:string)=>{const response=await fetch(`${apiBase}/v1/share/runs/${encodeURIComponent(token)}`);if(!response.ok)throw new Error('report_unavailable');return response.json() as Promise<RunReport>}
export const getArtifactUrl=(runId:string,artifactId:string,shareToken?:string)=>request<{url:string;expiresAt:string}>(`/v1/artifacts/${artifactId}/url`,{method:'POST',body:JSON.stringify({runId,shareToken})})

export const errorCode = (error: unknown) => (error instanceof ApiError ? error.code : 'request_failed')

// Public pages bounce logged-in users to the dashboard.
export function useRedirectIfAuthed() {
  const navigate = useNavigate()
  useEffect(() => {
    if (getToken()) navigate({ to: '/dashboard' })
  }, [navigate])
}
