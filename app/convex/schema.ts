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
});
