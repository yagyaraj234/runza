import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConvexWaitlistStore } from './waitlist.js'

afterEach(() => vi.unstubAllGlobals())

describe('ConvexWaitlistStore', () => {
  it('calls the waitlist mutation with the normalized email', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'success', value: { id: 'waitlist-id', joined: true } }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await new ConvexWaitlistStore('https://example.convex.cloud').join('person@example.com')

    expect(result).toEqual({ id: 'waitlist-id', joined: true })
    expect(fetchMock).toHaveBeenCalledWith('https://example.convex.cloud/api/mutation', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ path: 'waitlist:join', args: { email: 'person@example.com' }, format: 'json' }),
    }))
  })
})
