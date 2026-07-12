export interface WaitlistStore {
  join(email: string): Promise<{ id: string; joined: boolean }>
}

export class MemoryWaitlistStore implements WaitlistStore {
  private readonly emails = new Map<string, string>()
  async join(email: string) {
    const existing = this.emails.get(email)
    if (existing) return { id: existing, joined: false }
    const id = crypto.randomUUID()
    this.emails.set(email, id)
    return { id, joined: true }
  }
}

export class ConvexWaitlistStore implements WaitlistStore {
  constructor(private readonly url: string) {}
  async join(email: string) {
    if (!this.url) throw new Error('CONVEX_URL is required for the waitlist endpoint')
    const response = await fetch(`${this.url.replace(/\/$/, '')}/api/mutation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'waitlist:join', args: { email }, format: 'json' }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`Convex returned ${response.status}`)
    const payload = await response.json() as { status: 'success' | 'error'; value?: { id: string; joined: boolean }; errorMessage?: string }
    if (payload.status !== 'success' || !payload.value) throw new Error(payload.errorMessage ?? 'Convex mutation failed')
    return payload.value
  }
}
