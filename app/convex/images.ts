import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get an image record by its UUID.
 */
export const getByUUID = query({
  args: {
    uuid: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const image = await ctx.db
      .query("images")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .first();

    // Only return if owned by this user
    if (image && image.userId === args.userId) {
      return image;
    }
    return null;
  },
});

/**
 * Find images with a similar perceptual hash.
 * Returns all images within a reasonable hash range for client-side distance calculation.
 */
export const findByHash = query({
  args: {
    pHash: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get all images for this user (pHash comparison happens client-side)
    // For small datasets this is fine; for large ones we'd want a more sophisticated approach
    return await ctx.db
      .query("images")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Upsert an image record.
 * Creates if no record exists with this UUID, updates otherwise.
 */
export const upsert = mutation({
  args: {
    uuid: v.string(),
    pHash: v.string(),
    caption: v.string(),
    tags: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if image already exists
    const existing = await ctx.db
      .query("images")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        pHash: args.pHash,
        caption: args.caption,
        tags: args.tags,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    }

    // Create new record
    return await ctx.db.insert("images", args);
  },
});

/**
 * Update just the caption for an image.
 */
export const updateCaption = mutation({
  args: {
    uuid: v.string(),
    caption: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const image = await ctx.db
      .query("images")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .first();

    if (image && image.userId === args.userId) {
      await ctx.db.patch(image._id, {
        caption: args.caption,
        updatedAt: new Date().toISOString(),
      });
    }
  },
});

/**
 * Update the perceptual hash (e.g., after crop/upscale).
 */
export const updateHash = mutation({
  args: {
    uuid: v.string(),
    pHash: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const image = await ctx.db
      .query("images")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .first();

    if (image && image.userId === args.userId) {
      await ctx.db.patch(image._id, {
        pHash: args.pHash,
        updatedAt: new Date().toISOString(),
      });
    }
  },
});

/**
 * Delete an image record.
 */
export const remove = mutation({
  args: {
    uuid: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const image = await ctx.db
      .query("images")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .first();

    if (image && image.userId === args.userId) {
      await ctx.db.delete(image._id);
    }
  },
});

/**
 * Get all images for a user.
 */
export const listByUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("images")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});
