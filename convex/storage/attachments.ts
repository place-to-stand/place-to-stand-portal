/**
 * Task attachment storage functions for Convex
 *
 * Handles task file attachments. During migration, storagePath stores the
 * Supabase storage path. Post-migration, this can be updated to use Convex
 * file storage.
 *
 * NOTE: The schema uses `storagePath` (string) and `originalName` (string)
 * to match Supabase 1:1. Convex file storage operations are disabled during
 * migration.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import {
  requireUser,
  ensureClientAccessByTaskId,
} from "../lib/permissions";

/**
 * Allowed MIME types for task attachments
 */
export const ACCEPTED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
] as const;

/**
 * Maximum attachment file size (10MB)
 */
export const MAX_ATTACHMENT_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Generate an upload URL for attachment upload
 *
 * Returns a pre-signed URL that the client can use to upload the file directly.
 * User must have access to the task.
 */
export const generateUploadUrl = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    // Verify access to task
    await ensureClientAccessByTaskId(ctx, currentUser, args.taskId);

    // Generate and return upload URL
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save attachment to task
 *
 * Called after file upload to create the attachment record.
 * Uses storagePath and originalName to match Supabase schema 1:1.
 */
export const saveAttachment = mutation({
  args: {
    taskId: v.id("tasks"),
    storagePath: v.string(),
    originalName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    // Verify access to task
    await ensureClientAccessByTaskId(ctx, currentUser, args.taskId);

    // Validate file size
    if (args.fileSize > MAX_ATTACHMENT_FILE_SIZE) {
      throw new Error(`File size exceeds maximum of ${MAX_ATTACHMENT_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Create attachment record
    const now = Date.now();
    const attachmentId = await ctx.db.insert("taskAttachments", {
      taskId: args.taskId,
      uploadedBy: currentUser._id,
      storagePath: args.storagePath,
      originalName: args.originalName,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      createdAt: now,
      updatedAt: now,
    });

    return { attachmentId };
  },
});

/**
 * Delete attachment from task
 *
 * Soft deletes the attachment record. The actual file deletion
 * from storage should be handled separately (either in Supabase
 * or Convex storage depending on where the file is stored).
 */
export const deleteAttachment = mutation({
  args: {
    attachmentId: v.id("taskAttachments"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    // Get the attachment
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment || attachment.deletedAt !== undefined) {
      throw new Error("Attachment not found");
    }

    // Verify access to task
    await ensureClientAccessByTaskId(ctx, currentUser, attachment.taskId);

    // Soft delete the attachment record
    // NOTE: File deletion from storage is handled separately
    await ctx.db.patch(args.attachmentId, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get attachment URL
 *
 * Returns the storage path for the attachment.
 * The actual URL resolution depends on where the file is stored
 * (Supabase or Convex storage).
 */
export const getAttachmentUrl = query({
  args: {
    attachmentId: v.id("taskAttachments"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    // Get the attachment
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment || attachment.deletedAt !== undefined) {
      return null;
    }

    // Verify access to task
    await ensureClientAccessByTaskId(ctx, currentUser, attachment.taskId);

    // Return storage path - actual URL resolution is handled by the client
    return attachment.storagePath;
  },
});

/**
 * List attachments for a task
 *
 * Returns all non-deleted attachments for a task.
 */
export const listByTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    // Verify access to task
    await ensureClientAccessByTaskId(ctx, currentUser, args.taskId);

    // Get all attachments for task
    const attachments = await ctx.db
      .query("taskAttachments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return attachments;
  },
});
