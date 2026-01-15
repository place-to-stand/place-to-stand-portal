/**
 * User mutations for Convex
 *
 * Provides mutations for creating and updating user records.
 * Includes both admin operations and migration support.
 */

import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import {
  requireUser,
  requireRole,
  isAdmin,
  assertIsSelf,
} from "../lib/permissions";
import { userRoleValidator } from "../schema";

/**
 * Create a new user (admin only)
 *
 * Used for manually creating users or importing from Supabase.
 */
export const create = mutation({
  args: {
    email: v.string(),
    fullName: v.optional(v.string()),
    role: userRoleValidator,
    authId: v.optional(v.string()),
    supabaseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    // Check if email already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (existing) {
      throw new Error("A user with this email already exists");
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      fullName: args.fullName,
      role: args.role,
      authId: args.authId,
      supabaseId: args.supabaseId,
      createdAt: now,
      updatedAt: now,
    });

    return userId;
  },
});

/**
 * Update user profile
 *
 * Users can update their own profile; admins can update anyone.
 */
export const update = mutation({
  args: {
    userId: v.id("users"),
    fullName: v.optional(v.string()),
    role: v.optional(userRoleValidator),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    // Non-admins can only update themselves
    if (!isAdmin(currentUser)) {
      assertIsSelf(currentUser, args.userId);
      // Non-admins cannot change role
      if (args.role !== undefined) {
        throw new Error("Only admins can change user roles");
      }
    }

    const user = await ctx.db.get(args.userId);
    if (!user || user.deletedAt !== undefined) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.userId, {
      ...(args.fullName !== undefined ? { fullName: args.fullName } : {}),
      ...(args.role !== undefined ? { role: args.role } : {}),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Soft delete a user (admin only)
 */
export const archive = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.deletedAt !== undefined) {
      throw new Error("User is already archived");
    }

    await ctx.db.patch(args.userId, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Restore an archived user (admin only)
 */
export const restore = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.deletedAt === undefined) {
      throw new Error("User is not archived");
    }

    await ctx.db.patch(args.userId, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Link auth ID to existing user
 *
 * Used during migration to link Convex Auth identity to migrated users.
 */
export const linkAuthId = mutation({
  args: {
    userId: v.id("users"),
    authId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    const user = await ctx.db.get(args.userId);
    if (!user || user.deletedAt !== undefined) {
      throw new Error("User not found");
    }

    if (user.authId) {
      throw new Error("User already has an auth ID linked");
    }

    await ctx.db.patch(args.userId, {
      authId: args.authId,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================================
// INTERNAL MUTATIONS (For migration scripts)
// ============================================================

/**
 * Import user from Supabase (internal use only)
 *
 * Creates a user with all fields including migration tracking.
 * Does not require authentication (for use by migration scripts).
 */
export const importFromSupabase = internalMutation({
  args: {
    email: v.string(),
    fullName: v.optional(v.string()),
    role: userRoleValidator,
    supabaseId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if already imported (by supabaseId)
    const existingBySupabaseId = await ctx.db
      .query("users")
      .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.supabaseId))
      .first();

    if (existingBySupabaseId) {
      // Already imported, return existing ID
      return existingBySupabaseId._id;
    }

    // Check if email exists (might be manually created)
    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (existingByEmail) {
      // Link supabaseId to existing user
      await ctx.db.patch(existingByEmail._id, {
        supabaseId: args.supabaseId,
        updatedAt: Date.now(),
      });
      return existingByEmail._id;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      fullName: args.fullName,
      role: args.role,
      supabaseId: args.supabaseId,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      deletedAt: args.deletedAt,
    });

    return userId;
  },
});
