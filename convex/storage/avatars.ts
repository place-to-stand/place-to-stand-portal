/**
 * Avatar storage functions for Convex
 *
 * Handles user avatar URLs. During migration, avatarUrl stores the Supabase
 * storage URL. Post-migration, this can be updated to use Convex file storage.
 *
 * NOTE: The schema uses `avatarUrl` (string) to match Supabase 1:1.
 * Convex file storage operations are disabled during migration.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import {
  requireUser,
  isAdmin,
  assertIsSelf,
} from "../lib/permissions";

/**
 * Allowed MIME types for avatars
 */
export const ACCEPTED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/**
 * Maximum avatar file size (2MB)
 */
export const MAX_AVATAR_FILE_SIZE = 2 * 1024 * 1024;

/**
 * Generate an upload URL for avatar upload
 *
 * Returns a pre-signed URL that the client can use to upload the file directly.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // Require authentication
    await requireUser(ctx);

    // Generate and return upload URL
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save avatar URL to user profile
 *
 * Called after file upload to link the avatar URL to the user.
 * During migration, this stores Supabase URLs. Post-migration,
 * this can be updated to use Convex storage URLs.
 */
export const saveAvatar = mutation({
  args: {
    userId: v.id("users"),
    avatarUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    // Check permission: admin or self
    if (!isAdmin(currentUser)) {
      assertIsSelf(currentUser, args.userId);
    }

    // Get the user
    const user = await ctx.db.get(args.userId);
    if (!user || user.deletedAt !== undefined) {
      throw new Error("User not found");
    }

    // Update user with new avatar URL
    await ctx.db.patch(args.userId, {
      avatarUrl: args.avatarUrl,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Delete avatar from user profile
 *
 * Clears the user's avatarUrl.
 */
export const deleteAvatar = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    // Check permission: admin or self
    if (!isAdmin(currentUser)) {
      assertIsSelf(currentUser, args.userId);
    }

    // Get the user
    const user = await ctx.db.get(args.userId);
    if (!user || user.deletedAt !== undefined) {
      throw new Error("User not found");
    }

    // Clear avatar from user
    await ctx.db.patch(args.userId, {
      avatarUrl: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get avatar URL for a user
 *
 * Returns the avatar URL, or null if no avatar is set.
 */
export const getAvatarUrl = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Avatars are public (viewable by anyone authenticated)
    await requireUser(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user || user.deletedAt !== undefined) {
      return null;
    }

    return user.avatarUrl ?? null;
  },
});

/**
 * Get avatar URLs for multiple users
 *
 * Batch query for efficiency when displaying user lists.
 */
export const getAvatarUrls = query({
  args: {
    userIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const results: Record<string, string | null> = {};

    await Promise.all(
      args.userIds.map(async (userId) => {
        const user = await ctx.db.get(userId);
        if (user && user.deletedAt === undefined && user.avatarUrl) {
          results[userId] = user.avatarUrl;
        } else {
          results[userId] = null;
        }
      })
    );

    return results;
  },
});
