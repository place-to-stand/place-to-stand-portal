/**
 * Client queries for Convex
 *
 * Provides queries for fetching client data with permission enforcement.
 * All queries respect soft deletes and enforce client access control.
 *
 * Permission model:
 * - Admins: can see all clients
 * - Non-admins: can only see clients they are members of
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import {
  requireUser,
  isAdmin,
  listAccessibleClientIds,
  ensureClientAccess,
  NotFoundError,
} from "../lib/permissions";

/**
 * List all accessible clients for the current user
 *
 * Admins see all non-deleted clients.
 * Non-admins see only clients they are members of.
 * Results are sorted alphabetically by name.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    let clients;

    if (isAdmin(user)) {
      // Admins see all non-deleted clients
      clients = await ctx.db
        .query("clients")
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();
    } else {
      // Non-admins see only their accessible clients
      const accessibleIds = await listAccessibleClientIds(ctx, user);

      if (accessibleIds.length === 0) {
        return [];
      }

      // Fetch clients by IDs
      const fetchedClients = await Promise.all(
        accessibleIds.map(async (id) => {
          const client = await ctx.db.get(id);
          if (client && client.deletedAt === undefined) {
            return client;
          }
          return null;
        })
      );

      clients = fetchedClients.filter((c) => c !== null);
    }

    // Sort alphabetically by name (case-insensitive)
    return clients.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  },
});

/**
 * Get a client by ID
 *
 * Requires access to the client. Returns null if not found or no access.
 */
export const getById = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const client = await ctx.db.get(args.clientId);

    if (!client || client.deletedAt !== undefined) {
      return null;
    }

    // Check access
    try {
      await ensureClientAccess(ctx, user, args.clientId);
    } catch {
      return null;
    }

    return client;
  },
});

/**
 * Get a client by slug
 *
 * Requires access to the client. Returns null if not found or no access.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const client = await ctx.db
      .query("clients")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!client || client.deletedAt !== undefined) {
      return null;
    }

    // Check access
    try {
      await ensureClientAccess(ctx, user, client._id);
    } catch {
      return null;
    }

    return client;
  },
});

/**
 * List clients with project counts
 *
 * Returns clients with aggregated project metrics for dashboard display.
 * Admins see all; non-admins see only accessible clients.
 */
export const listWithProjectCounts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    let clients;

    if (isAdmin(user)) {
      clients = await ctx.db
        .query("clients")
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();
    } else {
      const accessibleIds = await listAccessibleClientIds(ctx, user);
      const fetchedClients = await Promise.all(
        accessibleIds.map(async (id) => {
          const client = await ctx.db.get(id);
          if (client && client.deletedAt === undefined) {
            return client;
          }
          return null;
        })
      );
      clients = fetchedClients.filter((c) => c !== null);
    }

    // For each client, count their projects
    const clientsWithCounts = await Promise.all(
      clients.map(async (client) => {
        // Query projects by clientId, then filter for non-deleted
        // Using filter instead of compound index for more reliable matching
        const allProjects = await ctx.db
          .query("projects")
          .filter((q) => q.eq(q.field("clientId"), client._id))
          .collect();

        const projects = allProjects.filter((p) => p.deletedAt === undefined);

        // Case-insensitive comparison to handle both "ACTIVE" and "active"
        const activeProjects = projects.filter(
          (p) => p.status?.toUpperCase() === "ACTIVE"
        );

        return {
          ...client,
          projectCount: projects.length,
          activeProjectCount: activeProjects.length,
          activeProjects: activeProjects.map((p) => ({
            id: p.supabaseId ?? p._id,
            name: p.name,
            slug: p.slug ?? null,
          })),
        };
      })
    );

    // Sort alphabetically by name (case-insensitive)
    return clientsWithCounts.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  },
});

/**
 * Get members of a client
 *
 * Returns all users who are members of the specified client.
 * Requires access to the client.
 */
export const getMembers = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Check client exists and is not deleted
    const client = await ctx.db.get(args.clientId);
    if (!client || client.deletedAt !== undefined) {
      throw new NotFoundError("Client not found");
    }

    // Check access
    await ensureClientAccess(ctx, user, args.clientId);

    // Get memberships
    const memberships = await ctx.db
      .query("clientMembers")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    // Fetch user details
    const members = await Promise.all(
      memberships.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        if (memberUser && memberUser.deletedAt === undefined) {
          return memberUser;
        }
        return null;
      })
    );

    return members.filter((m) => m !== null);
  },
});

/**
 * List archived (soft-deleted) clients with project counts
 *
 * Admin only. Returns clients where deletedAt is set.
 * Used by the archive management page.
 */
export const listArchivedWithProjectCounts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Admin only for archived clients
    if (!isAdmin(user)) {
      return [];
    }

    // Get archived clients (deletedAt is set)
    const allClients = await ctx.db.query("clients").collect();
    const archivedClients = allClients.filter((c) => c.deletedAt !== undefined);

    // For each client, count their projects
    const clientsWithCounts = await Promise.all(
      archivedClients.map(async (client) => {
        const allProjects = await ctx.db
          .query("projects")
          .filter((q) => q.eq(q.field("clientId"), client._id))
          .collect();

        const projects = allProjects.filter((p) => p.deletedAt === undefined);
        const activeProjects = projects.filter(
          (p) => p.status?.toUpperCase() === "ACTIVE"
        );

        return {
          ...client,
          projectCount: projects.length,
          activeProjectCount: activeProjects.length,
          activeProjects: activeProjects.map((p) => ({
            id: p.supabaseId ?? p._id,
            name: p.name,
            slug: p.slug ?? null,
          })),
        };
      })
    );

    // Sort alphabetically by name (case-insensitive)
    return clientsWithCounts.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  },
});
