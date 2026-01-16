/**
 * Client mutations for Convex
 *
 * Provides mutations for creating and managing client records.
 * All mutations require admin role except where noted.
 *
 * Cascade delete policy: Block archive if client has active projects.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  requireRole,
  NotFoundError,
} from "../lib/permissions";
import { clientBillingTypeValidator } from "../schema";

/**
 * Create a new client (admin only)
 *
 * During dual-write migration, accepts optional supabaseId for ID mapping.
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
    billingType: clientBillingTypeValidator,
    notes: v.optional(v.string()),
    supabaseId: v.optional(v.string()), // For dual-write migration
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "ADMIN");

    // Check slug uniqueness if provided
    if (args.slug) {
      const existingSlug = await ctx.db
        .query("clients")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug))
        .first();

      if (existingSlug) {
        throw new Error("A client with this slug already exists");
      }
    }

    const now = Date.now();
    const clientId = await ctx.db.insert("clients", {
      name: args.name,
      slug: args.slug,
      billingType: args.billingType,
      notes: args.notes,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
      supabaseId: args.supabaseId, // Store for ID mapping
    });

    return clientId;
  },
});

/**
 * Update a client
 *
 * Admin can update any client. Non-admins cannot update clients.
 * Accepts either a Convex ID or a Supabase UUID (for migration compatibility).
 */
export const update = mutation({
  args: {
    clientId: v.string(), // Accept string to handle both Convex ID and Supabase UUID
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    billingType: v.optional(clientBillingTypeValidator),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    // Resolve client - try direct lookup first, then by supabaseId
    let client = await ctx.db.get(args.clientId as Id<"clients">).catch(() => null);

    if (!client) {
      // Try looking up by supabaseId (for migration compatibility)
      client = await ctx.db
        .query("clients")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.clientId))
        .first();
    }

    if (!client || client.deletedAt !== undefined) {
      throw new NotFoundError("Client not found");
    }

    // Check slug uniqueness if changing
    if (args.slug !== undefined && args.slug !== client.slug) {
      const existingSlug = await ctx.db
        .query("clients")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug))
        .first();

      if (existingSlug && existingSlug._id !== client._id) {
        throw new Error("A client with this slug already exists");
      }
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.slug !== undefined) updates.slug = args.slug;
    if (args.billingType !== undefined) updates.billingType = args.billingType;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(client._id, updates);

    return { success: true };
  },
});

/**
 * Archive (soft delete) a client
 *
 * Admin only. Blocks if the client has non-deleted projects.
 * Accepts either a Convex ID or a Supabase UUID (for migration compatibility).
 */
export const archive = mutation({
  args: {
    clientId: v.string(), // Accept string to handle both Convex ID and Supabase UUID
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    // Resolve client - try direct lookup first, then by supabaseId
    let client = await ctx.db.get(args.clientId as Id<"clients">).catch(() => null);

    if (!client) {
      // Try looking up by supabaseId (for migration compatibility)
      client = await ctx.db
        .query("clients")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.clientId))
        .first();
    }

    if (!client) {
      throw new NotFoundError("Client not found");
    }

    if (client.deletedAt !== undefined) {
      throw new Error("Client is already archived");
    }

    // Check for active projects (cascade delete policy: block)
    // Using filter instead of compound index for reliable matching
    const allClientProjects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("clientId"), client._id))
      .collect();
    const activeProjects = allClientProjects.find(
      (p) => p.deletedAt === undefined
    );

    if (activeProjects) {
      throw new Error(
        "Cannot archive client with active projects. Archive or delete the projects first."
      );
    }

    await ctx.db.patch(client._id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Restore an archived client (admin only)
 *
 * Accepts either a Convex ID or a Supabase UUID (for migration compatibility).
 */
export const restore = mutation({
  args: {
    clientId: v.string(), // Accept string to handle both Convex ID and Supabase UUID
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    // Resolve client - try direct lookup first, then by supabaseId
    let client = await ctx.db.get(args.clientId as Id<"clients">).catch(() => null);

    if (!client) {
      // Try looking up by supabaseId (for migration compatibility)
      client = await ctx.db
        .query("clients")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.clientId))
        .first();
    }

    if (!client) {
      throw new NotFoundError("Client not found");
    }

    if (client.deletedAt === undefined) {
      throw new Error("Client is not archived");
    }

    await ctx.db.patch(client._id, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Add a member to a client
 *
 * Admin only. Creates a clientMembers record linking user to client.
 * Enforces uniqueness - user cannot be added twice to the same client.
 * Accepts either Convex IDs or Supabase UUIDs (for migration compatibility).
 */
export const addMember = mutation({
  args: {
    clientId: v.string(), // Accept string to handle both Convex ID and Supabase UUID
    userId: v.string(), // Accept string to handle both Convex ID and Supabase UUID
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    // Resolve client - try direct lookup first, then by supabaseId
    let client = await ctx.db.get(args.clientId as Id<"clients">).catch(() => null);
    if (!client) {
      client = await ctx.db
        .query("clients")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.clientId))
        .first();
    }
    if (!client || client.deletedAt !== undefined) {
      throw new NotFoundError("Client not found");
    }

    // Resolve user - try direct lookup first, then by supabaseId
    let user = await ctx.db.get(args.userId as Id<"users">).catch(() => null);
    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.userId))
        .first();
    }
    if (!user || user.deletedAt !== undefined) {
      throw new NotFoundError("User not found");
    }

    // Check for existing membership (uniqueness check)
    const existingMembership = await ctx.db
      .query("clientMembers")
      .withIndex("by_client_user", (q) =>
        q.eq("clientId", client._id).eq("userId", user._id)
      )
      .first();

    if (existingMembership) {
      // Already a member - this is fine during dual-write, just return success
      return existingMembership._id;
    }

    const now = Date.now();
    const memberId = await ctx.db.insert("clientMembers", {
      clientId: client._id,
      userId: user._id,
      createdAt: now,
      updatedAt: now,
    });

    return memberId;
  },
});

/**
 * Remove a member from a client
 *
 * Admin only. Deletes the clientMembers record.
 * Accepts either Convex IDs or Supabase UUIDs (for migration compatibility).
 */
export const removeMember = mutation({
  args: {
    clientId: v.string(), // Accept string to handle both Convex ID and Supabase UUID
    userId: v.string(), // Accept string to handle both Convex ID and Supabase UUID
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    // Resolve client - try direct lookup first, then by supabaseId
    let client = await ctx.db.get(args.clientId as Id<"clients">).catch(() => null);
    if (!client) {
      client = await ctx.db
        .query("clients")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.clientId))
        .first();
    }
    if (!client) {
      // If client doesn't exist, no membership to remove - this is fine
      return { success: true };
    }

    // Resolve user - try direct lookup first, then by supabaseId
    let user = await ctx.db.get(args.userId as Id<"users">).catch(() => null);
    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.userId))
        .first();
    }
    if (!user) {
      // If user doesn't exist, no membership to remove - this is fine
      return { success: true };
    }

    // Find the membership using resolved IDs
    const membership = await ctx.db
      .query("clientMembers")
      .withIndex("by_client_user", (q) =>
        q.eq("clientId", client._id).eq("userId", user._id)
      )
      .first();

    if (!membership) {
      // No membership to remove - this is fine during dual-write
      return { success: true };
    }

    // Hard delete the membership (junction tables typically don't soft delete)
    await ctx.db.delete(membership._id);

    return { success: true };
  },
});

/**
 * Permanently delete a client (hard delete)
 *
 * Admin only. Client must be archived first.
 * Also deletes all client memberships.
 * Accepts either a Convex ID or a Supabase UUID (for migration compatibility).
 */
export const destroy = mutation({
  args: {
    clientId: v.string(), // Accept string to handle both Convex ID and Supabase UUID
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    // Resolve client - try direct lookup first, then by supabaseId
    let client = await ctx.db.get(args.clientId as Id<"clients">).catch(() => null);

    if (!client) {
      // Try looking up by supabaseId (for migration compatibility)
      client = await ctx.db
        .query("clients")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.clientId))
        .first();
    }

    if (!client) {
      throw new NotFoundError("Client not found");
    }

    if (client.deletedAt === undefined) {
      throw new Error("Client must be archived before permanent deletion");
    }

    // Check for projects (block if any exist)
    const projects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("clientId"), client._id))
      .first();

    if (projects) {
      throw new Error("Cannot delete client with associated projects");
    }

    // Delete all client memberships first
    const memberships = await ctx.db
      .query("clientMembers")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();

    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }

    // Hard delete the client
    await ctx.db.delete(client._id);

    return { success: true };
  },
});
