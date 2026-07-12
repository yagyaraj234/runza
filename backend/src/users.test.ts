import { describe, expect, it } from 'vitest'
import { SqliteUserStore } from './users.js'

describe('SqliteUserStore', () => {
  it('creates users, rejects duplicates, and stores the installation id', async () => {
    const store = new SqliteUserStore(':memory:')
    const user = { email: 'a@b.com', name: 'Ada', passwordHash: 'salt:hash', createdAt: '2026-01-01T00:00:00.000Z' }
    expect(await store.create(user)).toEqual({ created: true })
    expect(await store.create(user)).toEqual({ created: false })
    expect(await store.getByEmail('a@b.com')).toMatchObject({ email: 'a@b.com', name: 'Ada', githubInstallationId: undefined })

    await store.setInstallation('a@b.com', '9876')
    expect((await store.getByEmail('a@b.com'))?.githubInstallationId).toBe('9876')
    expect((await store.getByInstallation('9876'))?.email).toBe('a@b.com')
    await store.create({...user,email:'other@b.com'})
    await expect(store.setInstallation('other@b.com','9876')).rejects.toThrow('installation_already_linked')
    await expect(store.setInstallation('missing@b.com', '1')).rejects.toThrow()
  })
})
