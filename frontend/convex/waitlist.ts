import { mutation } from './_generated/server'
import { v } from 'convex/values'

export const join = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase()
    const existing = await ctx.db
      .query('waitlist')
      .withIndex('by_email', (query) => query.eq('email', email))
      .unique()

    if (existing) return { id: existing._id, joined: false }

    const id = await ctx.db.insert('waitlist', { email })
    return { id, joined: true }
  },
})
