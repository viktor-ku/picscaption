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
});
