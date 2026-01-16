/**
 * Migration queries for validation
 *
 * These queries are used to validate dual-write consistency between
 * Supabase and Convex. They don't require authentication since they're
 * only used by internal validation scripts.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * List all clients for validation
 * Returns all clients including deleted ones
 */
export const listAllClients = query({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.db.query("clients").collect();

    return clients.map((c) => ({
      _id: c._id,
      supabaseId: c.supabaseId,
      name: c.name,
      slug: c.slug,
      billingType: c.billingType,
      notes: c.notes,
      deletedAt: c.deletedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  },
});

/**
 * List all projects for validation
 */
export const listAllProjects = query({
  args: {},
  handler: async (ctx) => {
    // Return raw documents to debug createdBy issue
    return await ctx.db.query("projects").collect();
  },
});

/**
 * List all users for validation
 */
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    return users.map((u) => ({
      _id: u._id,
      supabaseId: u.supabaseId,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      avatarUrl: u.avatarUrl,
      deletedAt: u.deletedAt,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  },
});

/**
 * List all client members for validation
 */
export const listAllClientMembers = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query("clientMembers").collect();

    return members.map((m) => ({
      _id: m._id,
      supabaseId: m.supabaseId,
      clientId: m.clientId,
      userId: m.userId,
      deletedAt: m.deletedAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  },
});

// ============================================================
// COUNT QUERIES (for validation script)
// ============================================================

/**
 * Count records in a table
 *
 * Used by validation script to compare counts between databases.
 */
export const countRecords = query({
  args: {
    table: v.union(
      v.literal("users"),
      v.literal("clients"),
      v.literal("clientMembers"),
      v.literal("projects"),
      v.literal("tasks"),
      v.literal("taskAssignees"),
      v.literal("taskComments"),
      v.literal("taskAttachments"),
      v.literal("timeLogs"),
      v.literal("hourBlocks"),
      v.literal("leads"),
      v.literal("contacts")
    ),
  },
  handler: async (ctx, args) => {
    // Count records based on table name
    switch (args.table) {
      case "users": {
        const records = await ctx.db.query("users").collect();
        return { total: records.length, active: records.filter((r) => !r.deletedAt).length };
      }
      case "clients": {
        const records = await ctx.db.query("clients").collect();
        return { total: records.length, active: records.filter((r) => !r.deletedAt).length };
      }
      case "clientMembers": {
        const records = await ctx.db.query("clientMembers").collect();
        return { total: records.length, active: records.filter((r) => !r.deletedAt).length };
      }
      case "projects": {
        const records = await ctx.db.query("projects").collect();
        return { total: records.length, active: records.filter((r) => !r.deletedAt).length };
      }
      case "tasks": {
        const records = await ctx.db.query("tasks").collect();
        return { total: records.length, active: records.filter((r) => !r.deletedAt).length };
      }
      case "taskAssignees": {
        const records = await ctx.db.query("taskAssignees").collect();
        return { total: records.length, active: records.filter((r) => !r.deletedAt).length };
      }
      case "taskComments": {
        const records = await ctx.db.query("taskComments").collect();
        return { total: records.length, active: records.filter((r) => !r.deletedAt).length };
      }
      case "taskAttachments": {
        const records = await ctx.db.query("taskAttachments").collect();
        return { total: records.length, active: records.filter((r) => !r.deletedAt).length };
      }
      case "timeLogs": {
        const records = await ctx.db.query("timeLogs").collect();
        return { total: records.length, active: records.filter((r) => !r.deletedAt).length };
      }
      case "hourBlocks": {
        const records = await ctx.db.query("hourBlocks").collect();
        return { total: records.length, active: records.filter((r) => !r.deletedAt).length };
      }
      case "leads": {
        const records = await ctx.db.query("leads").collect();
        return { total: records.length, active: records.filter((r) => !r.deletedAt).length };
      }
      case "contacts": {
        const records = await ctx.db.query("contacts").collect();
        return { total: records.length, active: records.filter((r) => !r.deletedAt).length };
      }
      default:
        throw new Error(`Unknown table: ${args.table}`);
    }
  },
});

// ============================================================
// MIGRATION RUN QUERIES
// ============================================================

/**
 * Get migration run history
 *
 * Used to review past migration runs.
 */
export const listMigrationRuns = query({
  args: {
    phase: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let queryBuilder = ctx.db.query("migrationRuns").order("desc");

    if (args.phase) {
      queryBuilder = ctx.db
        .query("migrationRuns")
        .withIndex("by_phase", (q) => q.eq("phase", args.phase!))
        .order("desc");
    }

    const limit = args.limit ?? 20;
    const runs = await queryBuilder.take(limit);

    return runs;
  },
});

/**
 * Get latest migration run for a phase
 */
export const getLatestMigrationRun = query({
  args: {
    phase: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("migrationRuns")
      .withIndex("by_phase", (q) => q.eq("phase", args.phase))
      .order("desc")
      .first();

    return run;
  },
});

