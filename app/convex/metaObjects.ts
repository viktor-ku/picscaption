import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get all meta objects for a user, ordered by their order field.
 */
export const listByUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const metaObjects = await ctx.db
      .query("metaObjects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Sort by order field
    return metaObjects.sort((a, b) => a.order - b.order);
  },
});

/**
 * Create a new meta object.
 */
export const create = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("string"), v.literal("number")),
    active: v.boolean(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if a meta object with this name already exists for this user
    const existing = await ctx.db
      .query("metaObjects")
      .withIndex("by_user_name", (q) =>
        q.eq("userId", args.userId).eq("name", args.name),
      )
      .first();

    if (existing) {
      throw new Error(`Meta object with name "${args.name}" already exists`);
    }

    // Get the max order value to append at the end
    const allObjects = await ctx.db
      .query("metaObjects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const maxOrder =
      allObjects.length > 0
        ? Math.max(...allObjects.map((obj) => obj.order))
        : -1;

    const now = new Date().toISOString();

    return await ctx.db.insert("metaObjects", {
      name: args.name,
      type: args.type,
      active: args.active,
      order: maxOrder + 1,
      userId: args.userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an existing meta object.
 */
export const update = mutation({
  args: {
    id: v.id("metaObjects"),
    name: v.optional(v.string()),
    type: v.optional(v.union(v.literal("string"), v.literal("number"))),
    active: v.optional(v.boolean()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const metaObject = await ctx.db.get(args.id);

    if (!metaObject || metaObject.userId !== args.userId) {
      throw new Error("Meta object not found");
    }

    // If name is being changed, check for duplicates
    if (args.name && args.name !== metaObject.name) {
      const existing = await ctx.db
        .query("metaObjects")
        .withIndex("by_user_name", (q) =>
          q.eq("userId", args.userId).eq("name", args.name),
        )
        .first();

      if (existing) {
        throw new Error(`Meta object with name "${args.name}" already exists`);
      }
    }

    const updates: Partial<{
      name: string;
      type: "string" | "number";
      active: boolean;
      updatedAt: string;
    }> = {
      updatedAt: new Date().toISOString(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.type !== undefined) updates.type = args.type;
    if (args.active !== undefined) updates.active = args.active;

    await ctx.db.patch(args.id, updates);
  },
});

/**
 * Toggle the active state of a meta object.
 */
export const toggleActive = mutation({
  args: {
    id: v.id("metaObjects"),
    active: v.boolean(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const metaObject = await ctx.db.get(args.id);

    if (!metaObject || metaObject.userId !== args.userId) {
      throw new Error("Meta object not found");
    }

    await ctx.db.patch(args.id, {
      active: args.active,
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Reorder meta objects by providing the new order of IDs.
 */
export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("metaObjects")),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify all IDs belong to this user and update their order
    for (let i = 0; i < args.orderedIds.length; i++) {
      const id = args.orderedIds[i];
      const metaObject = await ctx.db.get(id);

      if (!metaObject || metaObject.userId !== args.userId) {
        throw new Error("Meta object not found or unauthorized");
      }

      await ctx.db.patch(id, {
        order: i,
        updatedAt: new Date().toISOString(),
      });
    }
  },
});

/**
 * Delete a meta object.
 */
export const remove = mutation({
  args: {
    id: v.id("metaObjects"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const metaObject = await ctx.db.get(args.id);

    if (!metaObject || metaObject.userId !== args.userId) {
      throw new Error("Meta object not found");
    }

    await ctx.db.delete(args.id);
  },
});
