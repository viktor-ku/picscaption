import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    createdAt: v.number(),
    googleId: v.optional(v.string()),
    githubId: v.optional(v.string()),
  })
    .index("by_google_id", ["googleId"])
    .index("by_github_id", ["githubId"]),

  images: defineTable({
    uuid: v.string(), // Unique image identity (from sidecar)
    pHash: v.string(), // Perceptual hash for fallback matching
    caption: v.string(),
    tags: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    userId: v.id("users"), // Owner
  })
    .index("by_uuid", ["uuid"])
    .index("by_user", ["userId"])
    .index("by_phash_user", ["pHash", "userId"]),

  metaObjects: defineTable({
    name: v.string(), // Field name / key (e.g., "guidance", "steps")
    type: v.union(v.literal("string"), v.literal("number")), // Value type
    active: v.boolean(), // Whether to include in imports
    required: v.boolean(), // Whether this field is required during import
    order: v.number(), // Display/priority order
    userId: v.id("users"), // Owner
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"]),

  // Stores meta values for each image, linked to metaObjects definitions
  imageMetaValues: defineTable({
    imageId: v.id("images"), // The image this value belongs to
    metaObjectId: v.id("metaObjects"), // The meta object definition
    value: v.union(v.string(), v.number()), // The actual value
    userId: v.id("users"), // Owner (denormalized for efficient queries)
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_image", ["imageId"])
    .index("by_meta_object", ["metaObjectId"])
    .index("by_user", ["userId"])
    .index("by_image_meta", ["imageId", "metaObjectId"]),
});
