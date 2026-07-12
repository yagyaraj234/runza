import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
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

export const createShareToken = (runId: string, nonce: string, secret: string) =>
  `${runId}.${nonce}.${createHmac('sha256', secret).update(`${runId}.${nonce}`).digest('base64url')}`

export function verifyShareToken(token: string, runId: string, nonce: string | undefined, secret: string) {
  if (!nonce) return false
  const expected = Buffer.from(createShareToken(runId, nonce, secret)), actual = Buffer.from(token)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export const createArtifactSignature=(runId:string,artifactId:string,expires:number,secret:string)=>
  createHmac('sha256',secret).update(`${runId}.${artifactId}.${expires}`).digest('base64url')
export function verifyArtifactSignature(runId:string,artifactId:string,expires:number,signature:string,secret:string){
  if(!Number.isFinite(expires)||expires<Date.now())return false
  const expected=Buffer.from(createArtifactSignature(runId,artifactId,expires,secret)),actual=Buffer.from(signature)
  return expected.length===actual.length&&timingSafeEqual(expected,actual)
}
