import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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
    filename: v.string(),
    pHash: v.string(),
    caption: v.string(),
    tags: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if image already exists by UUID
    const existingByUuid = await ctx.db
      .query("images")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .first();

    if (existingByUuid) {
      // Update existing record
      await ctx.db.patch(existingByUuid._id, {
        filename: args.filename,
        pHash: args.pHash,
        hasImage: true,
        caption: args.caption,
        tags: args.tags,
        updatedAt: args.updatedAt,
      });
      return existingByUuid._id;
    }

    // Check if a metadata-first record exists by filename (no uuid yet)
    const existingByFilename = await ctx.db
      .query("images")
      .withIndex("by_filename_user", (q) =>
        q.eq("filename", args.filename).eq("userId", args.userId),
      )
      .first();

    if (existingByFilename && !existingByFilename.uuid) {
      // Upgrade metadata-first record with actual image data
      await ctx.db.patch(existingByFilename._id, {
        uuid: args.uuid,
        pHash: args.pHash,
        hasImage: true,
        caption: args.caption,
        tags: args.tags,
        updatedAt: args.updatedAt,
      });
      return existingByFilename._id;
    }

    // Create new record with hasImage: true (actual image being loaded)
    return await ctx.db.insert("images", {
      ...args,
      hasImage: true,
    });
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

/**
 * Get an image record by filename.
 */
export const getByFilename = query({
  args: {
    filename: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("images")
      .withIndex("by_filename_user", (q) =>
        q.eq("filename", args.filename).eq("userId", args.userId),
      )
      .first();
  },
});

/**
 * Upsert an image record by filename (for metadata-first CSV imports).
 * Creates a minimal record if it doesn't exist, returns the imageId.
 */
export const upsertByFilename = mutation({
  args: {
    filename: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if image already exists by filename
    const existing = await ctx.db
      .query("images")
      .withIndex("by_filename_user", (q) =>
        q.eq("filename", args.filename).eq("userId", args.userId),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    // Create a metadata-first record (no uuid or pHash yet, hasImage: false)
    const now = new Date().toISOString();
    return await ctx.db.insert("images", {
      filename: args.filename,
      hasImage: false,
      caption: "",
      tags: [],
      createdAt: now,
      updatedAt: now,
      userId: args.userId,
    });
  },
});

/**
 * Bulk upsert meta values for CSV import.
 * Creates image records as needed, then upserts all meta values.
 * Optimized to minimize database operations.
 * Returns counts of CSV rows created vs updated (by unique filename).
 */
export const bulkUpsertMetaValues = mutation({
  args: {
    values: v.array(
      v.object({
        filename: v.string(),
        metaObjectId: v.id("metaObjects"),
        value: v.union(v.string(), v.number()),
      }),
    ),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    // Track created vs updated rows (by unique filename, not meta values)
    let rowsCreated = 0;
    let rowsUpdated = 0;

    // Group values by filename for efficient processing
    const valuesByFilename = new Map<
      string,
      Array<{ metaObjectId: string; value: string | number }>
    >();
    for (const val of args.values) {
      const existing = valuesByFilename.get(val.filename) || [];
      existing.push({ metaObjectId: val.metaObjectId, value: val.value });
      valuesByFilename.set(val.filename, existing);
    }

    // Cache for image IDs to avoid redundant lookups
    const imageIdCache = new Map<string, string>();

    // Process each filename (each filename = 1 CSV row)
    for (const [filename, metaValues] of valuesByFilename) {
      // Find or create image record
      let imageId = imageIdCache.get(filename);
      let isNewRow = false;

      if (!imageId) {
        const image = await ctx.db
          .query("images")
          .withIndex("by_filename_user", (q) =>
            q.eq("filename", filename).eq("userId", args.userId),
          )
          .first();

        if (image) {
          imageId = image._id;
          rowsUpdated++; // Existing image record = updating a row
        } else {
          // Create metadata-first record (hasImage: false = no actual image yet)
          imageId = await ctx.db.insert("images", {
            filename,
            hasImage: false,
            caption: "",
            tags: [],
            createdAt: now,
            updatedAt: now,
            userId: args.userId,
          });
          isNewRow = true;
          rowsCreated++; // New image record = creating a row
        }
        imageIdCache.set(filename, imageId);
      }

      // Insert/update meta values for this row
      const typedImageId = imageId as Id<"images">;

      for (const { metaObjectId, value } of metaValues) {
        const typedMetaObjectId = metaObjectId as Id<"metaObjects">;

        // Check for existing value
        const existingValue = await ctx.db
          .query("imageMetaValues")
          .withIndex("by_image_meta", (q) =>
            q.eq("imageId", typedImageId).eq("metaObjectId", typedMetaObjectId),
          )
          .first();

        if (existingValue) {
          await ctx.db.patch(existingValue._id, {
            value,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("imageMetaValues", {
            imageId: typedImageId,
            metaObjectId: typedMetaObjectId,
            value,
            userId: args.userId,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    return {
      success: true,
      created: rowsCreated,
      updated: rowsUpdated,
    };
  },
});

/**
 * Get all meta values for an image by filename.
 */
export const getMetaValuesByFilename = query({
  args: {
    filename: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Find the image by filename
    const image = await ctx.db
      .query("images")
      .withIndex("by_filename_user", (q) =>
        q.eq("filename", args.filename).eq("userId", args.userId),
      )
      .first();

    if (!image) {
      return [];
    }

    // Get all meta values for this image
    return await ctx.db
      .query("imageMetaValues")
      .withIndex("by_image", (q) => q.eq("imageId", image._id))
      .collect();
  },
});

/**
 * Get meta values for multiple filenames at once (batch query).
 */
export const getMetaValuesByFilenames = query({
  args: {
    filenames: v.array(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const result: Record<
      string,
      Array<{ metaObjectId: string; value: string | number }>
    > = {};

    for (const filename of args.filenames) {
      const image = await ctx.db
        .query("images")
        .withIndex("by_filename_user", (q) =>
          q.eq("filename", filename).eq("userId", args.userId),
        )
        .first();

      if (image) {
        const metaValues = await ctx.db
          .query("imageMetaValues")
          .withIndex("by_image", (q) => q.eq("imageId", image._id))
          .collect();

        result[filename] = metaValues.map((mv) => ({
          metaObjectId: mv.metaObjectId,
          value: mv.value,
        }));
      }
    }

    return result;
  },
});
