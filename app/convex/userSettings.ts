import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Get user settings for a given user
 */
export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return settings;
  },
});

/**
 * Upsert the caption system prompt for a user
 */
export const upsertSystemPrompt = mutation({
  args: {
    userId: v.id("users"),
    systemPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const now = new Date().toISOString();

    if (existing) {
      await ctx.db.patch(existing._id, {
        captionSystemPrompt: args.systemPrompt,
        updatedAt: now,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("userSettings", {
      userId: args.userId,
      captionSystemPrompt: args.systemPrompt,
      updatedAt: now,
    });

    return id;
  },
});
