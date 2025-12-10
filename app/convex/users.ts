import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create a new anonymous user.
 * Called on first app visit when no user ID exists in localStorage.
 */
export const createAnonymousUser = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      createdAt: Date.now(),
    });
    return userId;
  },
});

/**
 * Get a user by their ID.
 */
export const getUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Update user's profile information.
 */
export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    await ctx.db.patch(userId, updates);
  },
});

/**
 * Link a Google account to an existing user.
 */
export const linkGoogleAccount = mutation({
  args: {
    userId: v.id("users"),
    googleId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      googleId: args.googleId,
    });
  },
});

/**
 * Link a GitHub account to an existing user.
 */
export const linkGithubAccount = mutation({
  args: {
    userId: v.id("users"),
    githubId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      githubId: args.githubId,
    });
  },
});
