import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'

const base = ((import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '')

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
}

const TOKEN_KEY = 'auth_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const logout = () => localStorage.removeItem(TOKEN_KEY)

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code) }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const response = await fetch(`${base}${path}`, {
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

export const errorCode = (error: unknown) => (error instanceof ApiError ? error.code : 'request_failed')

// Public pages bounce logged-in users to the dashboard.
export function useRedirectIfAuthed() {
  const navigate = useNavigate()
  useEffect(() => {
    if (getToken()) navigate({ to: '/dashboard' })
  }, [navigate])
}
