/**
 * User queries for Convex
 *
 * Provides queries for fetching user data.
 * All queries respect soft deletes and enforce authentication.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import {
  getCurrentUser,
  requireUser,
  requireRole,
  isAdmin,
  listAccessibleClientIds,
} from "../lib/permissions";

/**
 * Get the current authenticated user
 *
 * Returns null if not authenticated or user not found.
 * Used by the useConvexUser hook.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user;
  },
});

/**
 * Get a user by their ID
 *
 * Requires authentication. Admins can view any user,
 * non-admins can only view users in their accessible clients.
 */
export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user || user.deletedAt !== undefined) {
      return null;
    }

    // Admin can view any user
    if (isAdmin(currentUser)) {
      return user;
    }

    // Non-admin can view themselves
    if (user._id === currentUser._id) {
      return user;
    }

    // Non-admin can view users in their accessible clients
    const accessibleClientIds = await listAccessibleClientIds(ctx, currentUser);
    const userClientMemberships = await ctx.db
      .query("clientMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const hasOverlap = userClientMemberships.some((m) =>
      accessibleClientIds.includes(m.clientId)
    );

    if (!hasOverlap) {
      return null;
    }

    return user;
  },
});

/**
 * Get a user by email
 *
 * Admin-only query for looking up users by email.
 */
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (!user || user.deletedAt !== undefined) {
      return null;
    }

    return user;
  },
});

/**
 * List all users
 *
 * Admin-only query. Returns all non-deleted users.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "ADMIN");

    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return users;
  },
});

/**
 * List users in a specific client
 *
 * Requires access to the client. Returns all users who are members.
 */
export const listByClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    // Check client access (will throw if not authorized)
    const { ensureClientAccess } = await import("../lib/permissions");
    await ensureClientAccess(ctx, currentUser, args.clientId);

    // Get all members of this client
    const memberships = await ctx.db
      .query("clientMembers")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    // Fetch user details
    const users = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        if (user && user.deletedAt === undefined) {
          return user;
        }
        return null;
      })
    );

    return users.filter((u) => u !== null);
  },
});
