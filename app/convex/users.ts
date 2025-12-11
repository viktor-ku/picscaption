import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Default metaobjects for AI dataset users.
 * All are active (enabled) and not required (optional).
 */
const DEFAULT_META_OBJECTS: {
  name: string;
  type: "string" | "number";
}[] = [
  { name: "width", type: "number" },
  { name: "height", type: "number" },
  { name: "prompt", type: "string" },
  { name: "negative prompt", type: "string" },
  { name: "steps", type: "number" },
  { name: "guidance", type: "number" },
  { name: "lora scale", type: "number" },
  { name: "time taken seconds", type: "number" },
  { name: "seed", type: "number" },
  { name: "batch", type: "string" },
];

/**
 * Create a new anonymous user.
 * Called on first app visit when no user ID exists in localStorage.
 * Also creates default metaobjects for AI dataset workflows.
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

    // Create default metaobjects for the new user
    const now = new Date().toISOString();
    for (let i = 0; i < DEFAULT_META_OBJECTS.length; i++) {
      const metaObj = DEFAULT_META_OBJECTS[i];
      await ctx.db.insert("metaObjects", {
        name: metaObj.name,
        type: metaObj.type,
        active: true,
        required: false,
        order: i,
        userId,
        createdAt: now,
        updatedAt: now,
      });
    }

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
