import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { sign, verify } from 'hono/jwt'

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(password, salt, 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

const WEEK_SECONDS = 7 * 24 * 60 * 60

export function signToken(email: string, secret: string): Promise<string> {
  return sign({ sub: email, exp: Math.floor(Date.now() / 1000) + WEEK_SECONDS }, secret)
}

export async function verifyToken(token: string, secret: string): Promise<string | undefined> {
  try {
    const payload = await verify(token, secret, 'HS256')
    return typeof payload.sub === 'string' ? payload.sub : undefined
  } catch {
    return undefined
  }
}
