import { describe, expect, it } from 'vitest'
import { MemoryBillingStore } from './store.js'

describe('MemoryBillingStore', () => {
  it('normalizes accounts, grants idempotently and reports balances', async () => {
    const store = new MemoryBillingStore()
    await store.upsertSubscription({ accountKey: ' Person@Example.COM ', email: ' Person@Example.COM ', customerId: 'cus', subscriptionId: 'sub', plan: 'starter', status: 'active' })
    expect(await store.grantCredits({ accountKey: 'person@example.com', idempotencyKey: 'invoice-1', amount: 100 })).toBe(true)
    expect(await store.grantCredits({ accountKey: 'person@example.com', idempotencyKey: 'invoice-1', amount: 100 })).toBe(false)
    expect((await store.getAccount('PERSON@example.com'))?.balance).toEqual({ granted: 100, consumed: 0, reserved: 0, available: 100 })
  })
  it('atomically reserves without overspending and settles or releases once', async () => {
    const store = new MemoryBillingStore()
    await store.upsertSubscription({ accountKey:'a@example.com', email:'a@example.com', customerId:'c', subscriptionId:'s', plan:'starter', status:'active' })
    await store.grantCredits({ accountKey:'a@example.com', idempotencyKey:'g', amount:10 })
    expect(await Promise.all([store.reserveCredits({accountKey:'a@example.com',reservationId:'r1',amount:7}),store.reserveCredits({accountKey:'a@example.com',reservationId:'r2',amount:7})])).toEqual([true,false])
    expect(await store.settleReservation('r1')).toBe(true); expect(await store.settleReservation('r1')).toBe(false)
    expect((await store.getAccount('a@example.com'))?.balance.consumed).toBe(7)
  })
  it('rejects non-positive integer amounts', async () => {
    const store = new MemoryBillingStore()
    await expect(store.grantCredits({accountKey:'a@b.com',idempotencyKey:'x',amount:0})).rejects.toThrow()
  })
})
