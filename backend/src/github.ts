import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyGitHubSignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!secret || !signature?.startsWith('sha256=')) return false
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
  const left = Buffer.from(expected)
  const right = Buffer.from(signature)
  return left.length === right.length && timingSafeEqual(left, right)
}

export interface PullRequestWebhook {
  action: string
  repository: { full_name: string }
  pull_request: { number: number; head: { sha: string; repo?: { clone_url?: string } }; base: { sha: string } }
  installation?: { id: number }
}
