import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

// Only the backend may call these: it proves itself with AUTH_BRIDGE_SECRET
// (set the same value in the Convex deployment env and the backend env).
const guard = (secret: string) => {
  if (!process.env.AUTH_BRIDGE_SECRET || secret !== process.env.AUTH_BRIDGE_SECRET)
    throw new Error('unauthorized')
}

const userShape = {
  email: v.string(),
  name: v.string(),
  passwordHash: v.string(),
  githubInstallationId: v.optional(v.string()),
  createdAt: v.string(),
}

export const create = mutation({
  args: { ...userShape, secret: v.string() },
  handler: async (ctx, { secret, ...user }) => {
    guard(secret)
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', q => q.eq('email', user.email))
      .unique()
    if (existing) return { created: false }
    await ctx.db.insert('users', user)
    return { created: true }
  },
})

export const getByEmail = query({
  args: { email: v.string(), secret: v.string() },
  handler: async (ctx, { email, secret }) => {
    guard(secret)
    return await ctx.db
      .query('users')
      .withIndex('by_email', q => q.eq('email', email))
      .unique()
  },
})

export const getByInstallation = query({
  args: { installationId: v.string(), secret: v.string() },
  handler: async (ctx, { installationId, secret }) => {
    guard(secret)
    return await ctx.db
      .query('users')
      .withIndex('by_installation', q => q.eq('githubInstallationId', installationId))
      .first()
  },
})

export const setInstallation = mutation({
  args: { email: v.string(), installationId: v.string(), secret: v.string() },
  handler: async (ctx, { email, installationId, secret }) => {
    guard(secret)
    const owner = await ctx.db.query('users').withIndex('by_installation', q => q.eq('githubInstallationId', installationId)).first()
    if (owner && owner.email !== email) throw new Error('installation_already_linked')
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', q => q.eq('email', email))
      .unique()
    if (!user) throw new Error('user_not_found')
    await ctx.db.patch(user._id, { githubInstallationId: installationId })
    return null
  },
})
