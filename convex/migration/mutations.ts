/**
 * Migration mutations for importing data from Supabase
 *
 * These mutations are used by the import script to bulk import
 * data into Convex. They use a migration key for authentication.
 *
 * Set MIGRATION_KEY environment variable in Convex dashboard before running.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Verify migration key before allowing import
 */
async function verifyMigrationKey(migrationKey: string): Promise<void> {
  const expectedKey = process.env.MIGRATION_KEY;
  if (!expectedKey) {
    throw new Error("MIGRATION_KEY not set in Convex environment");
  }
  if (migrationKey !== expectedKey) {
    throw new Error("Invalid migration key");
  }
}

/**
 * Import a user record
 * Field names match Supabase schema exactly for 1:1 migration
 *
 * Delta sync behavior:
 * - If record doesn't exist: insert it
 * - If record exists and source updatedAt > existing updatedAt: update it
 * - If record exists and source updatedAt <= existing updatedAt: skip (return existing ID)
 */
export const importUser = mutation({
  args: {
    migrationKey: v.string(),
    email: v.string(),
    fullName: v.optional(v.string()), // Matches Supabase full_name
    avatarUrl: v.optional(v.string()), // Matches Supabase avatar_url
    role: v.string(),
    supabaseId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyMigrationKey(args.migrationKey);

    // Check if already imported
    const existing = await ctx.db
      .query("users")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.supabaseId))
      .first();

    if (existing) {
      // Delta sync: update if source is newer
      if (args.updatedAt > existing.updatedAt) {
        await ctx.db.patch(existing._id, {
          email: args.email.toLowerCase(),
          fullName: args.fullName,
          avatarUrl: args.avatarUrl,
          role: args.role as "ADMIN" | "CLIENT",
          updatedAt: args.updatedAt,
          deletedAt: args.deletedAt,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      fullName: args.fullName,
      avatarUrl: args.avatarUrl,
      role: args.role as "ADMIN" | "CLIENT",
      supabaseId: args.supabaseId,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      deletedAt: args.deletedAt,
    });
  },
});

/**
 * Import a client record
 * Field names match Supabase schema exactly for 1:1 migration
 *
 * Delta sync behavior: updates if source updatedAt > existing updatedAt
 */
export const importClient = mutation({
  args: {
    migrationKey: v.string(),
    name: v.string(),
    slug: v.optional(v.string()), // Nullable in Supabase
    billingType: v.string(),
    notes: v.optional(v.string()),
    createdBySupabaseId: v.optional(v.string()), // Matches Supabase created_by
    supabaseId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyMigrationKey(args.migrationKey);

    const existing = await ctx.db
      .query("clients")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.supabaseId))
      .first();

    // Resolve createdBy foreign key if provided
    let createdBy = undefined;
    if (args.createdBySupabaseId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.createdBySupabaseId))
        .first();
      createdBy = user?._id;
    }

    if (existing) {
      // Delta sync: update if source is newer
      if (args.updatedAt > existing.updatedAt) {
        await ctx.db.patch(existing._id, {
          name: args.name,
          slug: args.slug,
          billingType: args.billingType as "prepaid" | "net_30",
          notes: args.notes,
          createdBy,
          updatedAt: args.updatedAt,
          deletedAt: args.deletedAt,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("clients", {
      name: args.name,
      slug: args.slug,
      billingType: args.billingType as "prepaid" | "net_30",
      notes: args.notes,
      createdBy,
      supabaseId: args.supabaseId,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      deletedAt: args.deletedAt,
    });
  },
});

/**
 * Import a client member record
 */
export const importClientMember = mutation({
  args: {
    migrationKey: v.string(),
    clientSupabaseId: v.string(),
    userSupabaseId: v.string(),
    supabaseId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await verifyMigrationKey(args.migrationKey);

    const existing = await ctx.db
      .query("clientMembers")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.supabaseId))
      .first();

    if (existing) {
      return existing._id;
    }

    // Resolve foreign keys
    const client = await ctx.db
      .query("clients")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.clientSupabaseId))
      .first();

    const user = await ctx.db
      .query("users")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.userSupabaseId))
      .first();

    if (!client || !user) {
      throw new Error(`Missing foreign key: client=${!!client}, user=${!!user}`);
    }

    return await ctx.db.insert("clientMembers", {
      clientId: client._id,
      userId: user._id,
      supabaseId: args.supabaseId,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    });
  },
});

/**
 * Import a project record
 * Field names match Supabase schema exactly for 1:1 migration
 *
 * Delta sync behavior: updates if source updatedAt > existing updatedAt
 */
export const importProject = mutation({
  args: {
    migrationKey: v.string(),
    name: v.string(),
    slug: v.optional(v.string()), // Nullable in Supabase
    type: v.string(),
    status: v.string(),
    startsOn: v.optional(v.string()), // Matches Supabase starts_on
    endsOn: v.optional(v.string()), // Matches Supabase ends_on
    clientSupabaseId: v.optional(v.string()),
    createdBySupabaseId: v.optional(v.string()), // Matches Supabase created_by (nullable)
    supabaseId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyMigrationKey(args.migrationKey);

    const existing = await ctx.db
      .query("projects")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.supabaseId))
      .first();

    // Resolve foreign keys
    let clientId = undefined;
    if (args.clientSupabaseId) {
      const client = await ctx.db
        .query("clients")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.clientSupabaseId))
        .first();
      clientId = client?._id;
    }

    let createdBy = undefined;
    if (args.createdBySupabaseId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.createdBySupabaseId))
        .first();
      createdBy = user?._id;
    }

    if (existing) {
      // Delta sync: update if source is newer
      if (args.updatedAt > existing.updatedAt) {
        await ctx.db.patch(existing._id, {
          name: args.name,
          slug: args.slug,
          type: args.type as "CLIENT" | "PERSONAL" | "INTERNAL",
          status: args.status as "ONBOARDING" | "ACTIVE" | "ON_HOLD" | "COMPLETED",
          startsOn: args.startsOn,
          endsOn: args.endsOn,
          clientId,
          createdBy,
          updatedAt: args.updatedAt,
          deletedAt: args.deletedAt,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("projects", {
      name: args.name,
      slug: args.slug,
      type: args.type as "CLIENT" | "PERSONAL" | "INTERNAL",
      status: args.status as "ONBOARDING" | "ACTIVE" | "ON_HOLD" | "COMPLETED",
      startsOn: args.startsOn,
      endsOn: args.endsOn,
      clientId,
      createdBy,
      supabaseId: args.supabaseId,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      deletedAt: args.deletedAt,
    });
  },
});

/**
 * Import a task record
 * Field names match Supabase schema exactly for 1:1 migration
 *
 * Delta sync behavior: updates if source updatedAt > existing updatedAt
 */
export const importTask = mutation({
  args: {
    migrationKey: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    rank: v.string(),
    projectSupabaseId: v.string(),
    dueOn: v.optional(v.string()), // Matches Supabase due_on (date string)
    createdBySupabaseId: v.optional(v.string()), // Matches Supabase created_by
    updatedBySupabaseId: v.optional(v.string()), // Matches Supabase updated_by
    acceptedAt: v.optional(v.number()), // Matches Supabase accepted_at
    supabaseId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyMigrationKey(args.migrationKey);

    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.supabaseId))
      .first();

    // Resolve project
    const project = await ctx.db
      .query("projects")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.projectSupabaseId))
      .first();

    if (!project) {
      throw new Error(`Missing project: ${args.projectSupabaseId}`);
    }

    // Resolve createdBy
    let createdBy = undefined;
    if (args.createdBySupabaseId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.createdBySupabaseId))
        .first();
      createdBy = user?._id;
    }

    // Resolve updatedBy
    let updatedBy = undefined;
    if (args.updatedBySupabaseId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.updatedBySupabaseId))
        .first();
      updatedBy = user?._id;
    }

    if (existing) {
      // Delta sync: update if source is newer
      if (args.updatedAt > existing.updatedAt) {
        await ctx.db.patch(existing._id, {
          title: args.title,
          description: args.description,
          status: args.status as "BACKLOG" | "ON_DECK" | "IN_PROGRESS" | "IN_REVIEW" | "BLOCKED" | "DONE" | "ARCHIVED",
          rank: args.rank,
          projectId: project._id,
          dueOn: args.dueOn,
          createdBy,
          updatedBy,
          acceptedAt: args.acceptedAt,
          updatedAt: args.updatedAt,
          deletedAt: args.deletedAt,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: args.status as "BACKLOG" | "ON_DECK" | "IN_PROGRESS" | "IN_REVIEW" | "BLOCKED" | "DONE" | "ARCHIVED",
      rank: args.rank,
      projectId: project._id,
      dueOn: args.dueOn,
      createdBy,
      updatedBy,
      acceptedAt: args.acceptedAt,
      supabaseId: args.supabaseId,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      deletedAt: args.deletedAt,
    });
  },
});
