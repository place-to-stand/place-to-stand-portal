/**
 * Migration mutations for importing data from Supabase
 *
 * These mutations are used by the import script to bulk import
 * data into Convex. They use a migration key for authentication.
 *
 * Set MIGRATION_KEY environment variable in Convex dashboard before running.
 *
 * Delta sync behavior:
 * - If record doesn't exist: insert it (operation: "inserted")
 * - If record exists and source updatedAt > existing updatedAt: update it (operation: "updated")
 * - If record exists and source updatedAt <= existing updatedAt: skip (operation: "skipped")
 *
 * All mutations return: { id: string, operation: "inserted" | "updated" | "skipped" }
 */

import { mutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

// ============================================================
// TYPES
// ============================================================

/**
 * Result type for all import mutations
 */
type ImportResult = {
  id: string;
  operation: "inserted" | "updated" | "skipped";
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if strings are equal, false otherwise.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify migration key before allowing import.
 * Uses constant-time comparison to prevent timing attacks.
 */
async function verifyMigrationKey(migrationKey: string): Promise<void> {
  const expectedKey = process.env.MIGRATION_KEY;
  if (!expectedKey) {
    throw new Error("MIGRATION_KEY not set in Convex environment");
  }
  if (!constantTimeEqual(migrationKey, expectedKey)) {
    throw new Error("Invalid migration key");
  }
}

/**
 * Resolve a user foreign key by supabaseId.
 * Logs a warning if the reference cannot be resolved.
 */
async function resolveUserFK(
  ctx: MutationCtx,
  supabaseId: string | undefined,
  fieldName: string,
  recordContext: string
): Promise<Id<"users"> | undefined> {
  if (!supabaseId) return undefined;

  const user = await ctx.db
    .query("users")
    .withIndex("by_supabaseId", (q) => q.eq("supabaseId", supabaseId))
    .first();

  if (!user) {
    console.warn(
      `[migration] Could not resolve ${fieldName}: user with supabaseId ${supabaseId} not found. ` +
        `${recordContext} will have no ${fieldName} link.`
    );
    return undefined;
  }

  return user._id;
}

/**
 * Resolve a client foreign key by supabaseId.
 * Logs a warning if the reference cannot be resolved.
 */
async function resolveClientFK(
  ctx: MutationCtx,
  supabaseId: string | undefined,
  recordContext: string
): Promise<Id<"clients"> | undefined> {
  if (!supabaseId) return undefined;

  const client = await ctx.db
    .query("clients")
    .withIndex("by_supabaseId", (q) => q.eq("supabaseId", supabaseId))
    .first();

  if (!client) {
    console.warn(
      `[migration] Could not resolve clientId: client with supabaseId ${supabaseId} not found. ` +
        `${recordContext} will have no client link.`
    );
    return undefined;
  }

  return client._id;
}

// ============================================================
// IMPORT MUTATIONS
// ============================================================

/**
 * Import a user record
 * Field names match Supabase schema exactly for 1:1 migration
 */
export const importUser = mutation({
  args: {
    migrationKey: v.string(),
    email: v.string(),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    role: v.string(),
    supabaseId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ImportResult> => {
    await verifyMigrationKey(args.migrationKey);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.supabaseId))
      .first();

    if (existing) {
      // Delta sync: update only if source is newer (strict greater-than)
      if (args.updatedAt > existing.updatedAt) {
        await ctx.db.patch(existing._id, {
          email: args.email.toLowerCase(),
          fullName: args.fullName,
          avatarUrl: args.avatarUrl,
          role: args.role as "ADMIN" | "CLIENT",
          updatedAt: args.updatedAt,
          deletedAt: args.deletedAt,
        });
        console.log(
          `[importUser] Updated ${args.email}: source updatedAt ${args.updatedAt} > existing ${existing.updatedAt}`
        );
        return { id: existing._id, operation: "updated" };
      }

      console.log(
        `[importUser] Skipped ${args.email}: source updatedAt ${args.updatedAt} <= existing ${existing.updatedAt}`
      );
      return { id: existing._id, operation: "skipped" };
    }

    const id = await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      fullName: args.fullName,
      avatarUrl: args.avatarUrl,
      role: args.role as "ADMIN" | "CLIENT",
      supabaseId: args.supabaseId,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      deletedAt: args.deletedAt,
    });

    console.log(`[importUser] Inserted ${args.email}`);
    return { id, operation: "inserted" };
  },
});

/**
 * Import a client record
 * Field names match Supabase schema exactly for 1:1 migration
 */
export const importClient = mutation({
  args: {
    migrationKey: v.string(),
    name: v.string(),
    slug: v.optional(v.string()),
    billingType: v.string(),
    notes: v.optional(v.string()),
    createdBySupabaseId: v.optional(v.string()),
    supabaseId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ImportResult> => {
    await verifyMigrationKey(args.migrationKey);

    const existing = await ctx.db
      .query("clients")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.supabaseId))
      .first();

    if (existing) {
      // Check if update is needed before resolving FKs (optimization)
      if (args.updatedAt <= existing.updatedAt) {
        console.log(
          `[importClient] Skipped ${args.name}: source updatedAt ${args.updatedAt} <= existing ${existing.updatedAt}`
        );
        return { id: existing._id, operation: "skipped" };
      }

      // Resolve FK only when we're actually updating
      const createdBy = await resolveUserFK(ctx, args.createdBySupabaseId, "createdBy", `Client "${args.name}"`);

      await ctx.db.patch(existing._id, {
        name: args.name,
        slug: args.slug,
        billingType: args.billingType as "prepaid" | "net_30",
        notes: args.notes,
        createdBy,
        updatedAt: args.updatedAt,
        deletedAt: args.deletedAt,
      });

      console.log(
        `[importClient] Updated ${args.name}: source updatedAt ${args.updatedAt} > existing ${existing.updatedAt}`
      );
      return { id: existing._id, operation: "updated" };
    }

    // New record - resolve FK and insert
    const createdBy = await resolveUserFK(ctx, args.createdBySupabaseId, "createdBy", `Client "${args.name}"`);

    const id = await ctx.db.insert("clients", {
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

    console.log(`[importClient] Inserted ${args.name}`);
    return { id, operation: "inserted" };
  },
});

/**
 * Import a client member record
 *
 * Note: This is a junction table. Delta sync updates the relationship if needed,
 * but typically junction table records don't change after creation.
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
  handler: async (ctx, args): Promise<ImportResult> => {
    await verifyMigrationKey(args.migrationKey);

    const existing = await ctx.db
      .query("clientMembers")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.supabaseId))
      .first();

    if (existing) {
      // Delta sync for junction table - check if update needed
      if (args.updatedAt <= existing.updatedAt) {
        console.log(
          `[importClientMember] Skipped ${args.supabaseId}: source updatedAt ${args.updatedAt} <= existing ${existing.updatedAt}`
        );
        return { id: existing._id, operation: "skipped" };
      }

      // Resolve foreign keys for update
      const client = await ctx.db
        .query("clients")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.clientSupabaseId))
        .first();

      const user = await ctx.db
        .query("users")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.userSupabaseId))
        .first();

      if (!client || !user) {
        throw new Error(
          `[importClientMember] Missing foreign key for update: client=${!!client}, user=${!!user}`
        );
      }

      await ctx.db.patch(existing._id, {
        clientId: client._id,
        userId: user._id,
        updatedAt: args.updatedAt,
      });

      console.log(
        `[importClientMember] Updated ${args.supabaseId}: source updatedAt ${args.updatedAt} > existing ${existing.updatedAt}`
      );
      return { id: existing._id, operation: "updated" };
    }

    // New record - resolve foreign keys
    const client = await ctx.db
      .query("clients")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.clientSupabaseId))
      .first();

    const user = await ctx.db
      .query("users")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.userSupabaseId))
      .first();

    if (!client || !user) {
      throw new Error(
        `[importClientMember] Missing foreign key for insert: client=${!!client}, user=${!!user}`
      );
    }

    const id = await ctx.db.insert("clientMembers", {
      clientId: client._id,
      userId: user._id,
      supabaseId: args.supabaseId,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    });

    console.log(`[importClientMember] Inserted client member ${args.supabaseId}`);
    return { id, operation: "inserted" };
  },
});

/**
 * Import a project record
 * Field names match Supabase schema exactly for 1:1 migration
 */
export const importProject = mutation({
  args: {
    migrationKey: v.string(),
    name: v.string(),
    slug: v.optional(v.string()),
    type: v.string(),
    status: v.string(),
    startsOn: v.optional(v.string()),
    endsOn: v.optional(v.string()),
    clientSupabaseId: v.optional(v.string()),
    createdBySupabaseId: v.optional(v.string()),
    supabaseId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ImportResult> => {
    await verifyMigrationKey(args.migrationKey);

    const existing = await ctx.db
      .query("projects")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.supabaseId))
      .first();

    if (existing) {
      // Check if update is needed before resolving FKs (optimization)
      if (args.updatedAt <= existing.updatedAt) {
        console.log(
          `[importProject] Skipped ${args.name}: source updatedAt ${args.updatedAt} <= existing ${existing.updatedAt}`
        );
        return { id: existing._id, operation: "skipped" };
      }

      // Resolve FKs only when updating
      const clientId = await resolveClientFK(ctx, args.clientSupabaseId, `Project "${args.name}"`);
      const createdBy = await resolveUserFK(ctx, args.createdBySupabaseId, "createdBy", `Project "${args.name}"`);

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

      console.log(
        `[importProject] Updated ${args.name}: source updatedAt ${args.updatedAt} > existing ${existing.updatedAt}`
      );
      return { id: existing._id, operation: "updated" };
    }

    // New record - resolve FKs and insert
    const clientId = await resolveClientFK(ctx, args.clientSupabaseId, `Project "${args.name}"`);
    const createdBy = await resolveUserFK(ctx, args.createdBySupabaseId, "createdBy", `Project "${args.name}"`);

    const id = await ctx.db.insert("projects", {
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

    console.log(`[importProject] Inserted ${args.name}`);
    return { id, operation: "inserted" };
  },
});

/**
 * Import a task record
 * Field names match Supabase schema exactly for 1:1 migration
 */
export const importTask = mutation({
  args: {
    migrationKey: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    rank: v.string(),
    projectSupabaseId: v.string(),
    dueOn: v.optional(v.string()),
    createdBySupabaseId: v.optional(v.string()),
    updatedBySupabaseId: v.optional(v.string()),
    acceptedAt: v.optional(v.number()),
    supabaseId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ImportResult> => {
    await verifyMigrationKey(args.migrationKey);

    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.supabaseId))
      .first();

    // Project is required - resolve it first (throws if missing)
    const project = await ctx.db
      .query("projects")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.projectSupabaseId))
      .first();

    if (!project) {
      throw new Error(`[importTask] Missing required project: ${args.projectSupabaseId} for task "${args.title}"`);
    }

    if (existing) {
      // Check if update is needed before resolving optional FKs
      if (args.updatedAt <= existing.updatedAt) {
        console.log(
          `[importTask] Skipped "${args.title}": source updatedAt ${args.updatedAt} <= existing ${existing.updatedAt}`
        );
        return { id: existing._id, operation: "skipped" };
      }

      // Resolve optional FKs only when updating
      const createdBy = await resolveUserFK(ctx, args.createdBySupabaseId, "createdBy", `Task "${args.title}"`);
      const updatedBy = await resolveUserFK(ctx, args.updatedBySupabaseId, "updatedBy", `Task "${args.title}"`);

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

      console.log(
        `[importTask] Updated "${args.title}": source updatedAt ${args.updatedAt} > existing ${existing.updatedAt}`
      );
      return { id: existing._id, operation: "updated" };
    }

    // New record - resolve optional FKs and insert
    const createdBy = await resolveUserFK(ctx, args.createdBySupabaseId, "createdBy", `Task "${args.title}"`);
    const updatedBy = await resolveUserFK(ctx, args.updatedBySupabaseId, "updatedBy", `Task "${args.title}"`);

    const id = await ctx.db.insert("tasks", {
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

    console.log(`[importTask] Inserted "${args.title}"`);
    return { id, operation: "inserted" };
  },
});
