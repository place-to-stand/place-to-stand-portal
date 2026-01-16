/**
 * Project mutations for Convex
 *
 * Provides mutations for creating and managing project records.
 * All mutations require admin role.
 *
 * Cascade delete policy: Block archive if project has active tasks.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { requireRole, NotFoundError } from "../lib/permissions";
import { projectTypeValidator, projectStatusValidator } from "../schema";

/**
 * Create a new project (admin only)
 *
 * During dual-write migration, accepts optional supabaseId for ID mapping.
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
    type: projectTypeValidator,
    status: projectStatusValidator,
    clientId: v.optional(v.string()), // Accept string to handle Supabase UUID
    startsOn: v.optional(v.string()),
    endsOn: v.optional(v.string()),
    supabaseId: v.optional(v.string()), // For dual-write migration
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "ADMIN");

    // Check slug uniqueness if provided (exclude archived projects)
    if (args.slug) {
      const existingSlug = await ctx.db
        .query("projects")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug))
        .first();

      // Only block if the existing project is not archived
      if (existingSlug && existingSlug.deletedAt === undefined) {
        throw new Error("A project with this slug already exists");
      }
    }

    // Resolve clientId if provided (for CLIENT type projects)
    let resolvedClientId: Id<"clients"> | undefined;
    if (args.clientId) {
      // Try direct lookup first
      let client = await ctx.db
        .get(args.clientId as Id<"clients">)
        .catch(() => null);

      // Fall back to supabaseId lookup
      if (!client) {
        client = await ctx.db
          .query("clients")
          .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.clientId))
          .first();
      }

      if (!client || client.deletedAt !== undefined) {
        throw new NotFoundError("Client not found");
      }

      resolvedClientId = client._id;
    }

    // Validate type/clientId relationship
    if (args.type === "CLIENT" && !resolvedClientId) {
      throw new Error("CLIENT type projects require a clientId");
    }
    if (args.type !== "CLIENT" && resolvedClientId) {
      throw new Error("PERSONAL and INTERNAL projects cannot have a clientId");
    }

    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      slug: args.slug,
      type: args.type,
      status: args.status,
      clientId: resolvedClientId,
      startsOn: args.startsOn,
      endsOn: args.endsOn,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
      supabaseId: args.supabaseId, // Store for ID mapping
    });

    return projectId;
  },
});

/**
 * Update a project
 *
 * Admin only.
 * Accepts either a Convex ID or a Supabase UUID (for migration compatibility).
 */
export const update = mutation({
  args: {
    projectId: v.string(), // Accept string to handle both Convex ID and Supabase UUID
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    type: v.optional(projectTypeValidator),
    status: v.optional(projectStatusValidator),
    clientId: v.optional(v.union(v.string(), v.null())),
    startsOn: v.optional(v.union(v.string(), v.null())),
    endsOn: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    // Resolve project - try direct lookup first, then by supabaseId
    let project = await ctx.db
      .get(args.projectId as Id<"projects">)
      .catch(() => null);

    if (!project) {
      // Try looking up by supabaseId (for migration compatibility)
      project = await ctx.db
        .query("projects")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.projectId))
        .first();
    }

    if (!project || project.deletedAt !== undefined) {
      throw new NotFoundError("Project not found");
    }

    // Check slug uniqueness if changing (exclude archived projects)
    if (args.slug !== undefined && args.slug !== project.slug) {
      const existingSlug = await ctx.db
        .query("projects")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug))
        .first();

      // Only block if the existing project is not archived and is a different project
      if (
        existingSlug &&
        existingSlug._id !== project._id &&
        existingSlug.deletedAt === undefined
      ) {
        throw new Error("A project with this slug already exists");
      }
    }

    // Resolve clientId if being updated
    let resolvedClientId: Id<"clients"> | undefined | null = undefined;
    if (args.clientId !== undefined) {
      if (args.clientId === null) {
        resolvedClientId = null;
      } else {
        const clientIdValue = args.clientId; // string - narrowed from union
        // Try direct lookup first
        let client = await ctx.db
          .get(clientIdValue as Id<"clients">)
          .catch(() => null);

        // Fall back to supabaseId lookup
        if (!client) {
          client = await ctx.db
            .query("clients")
            .withIndex("by_supabaseId", (q) => q.eq("supabaseId", clientIdValue))
            .first();
        }

        if (!client || client.deletedAt !== undefined) {
          throw new NotFoundError("Client not found");
        }

        resolvedClientId = client._id;
      }
    }

    // Validate type/clientId relationship if type is changing
    const newType = args.type ?? project.type;
    const newClientId =
      resolvedClientId !== undefined ? resolvedClientId : project.clientId;

    if (newType === "CLIENT" && !newClientId) {
      throw new Error("CLIENT type projects require a clientId");
    }
    if (newType !== "CLIENT" && newClientId) {
      throw new Error("PERSONAL and INTERNAL projects cannot have a clientId");
    }

    // Build update object with only provided fields
    // Note: Convert null to undefined for optional fields (Convex schema uses v.optional, not v.union with null)
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.slug !== undefined) updates.slug = args.slug ?? undefined;
    if (args.type !== undefined) updates.type = args.type;
    if (args.status !== undefined) updates.status = args.status;
    if (resolvedClientId !== undefined) updates.clientId = resolvedClientId ?? undefined;
    // Convert null to undefined for date fields (schema uses v.optional(v.string()), not v.union)
    if (args.startsOn !== undefined) updates.startsOn = args.startsOn ?? undefined;
    if (args.endsOn !== undefined) updates.endsOn = args.endsOn ?? undefined;

    await ctx.db.patch(project._id, updates);

    return { success: true };
  },
});

/**
 * Archive (soft delete) a project
 *
 * Admin only. Blocks if the project has non-deleted active tasks.
 * Accepts either a Convex ID or a Supabase UUID (for migration compatibility).
 */
export const archive = mutation({
  args: {
    projectId: v.string(), // Accept string to handle both Convex ID and Supabase UUID
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    // Resolve project - try direct lookup first, then by supabaseId
    let project = await ctx.db
      .get(args.projectId as Id<"projects">)
      .catch(() => null);

    if (!project) {
      // Try looking up by supabaseId (for migration compatibility)
      project = await ctx.db
        .query("projects")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.projectId))
        .first();
    }

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    if (project.deletedAt !== undefined) {
      throw new Error("Project is already archived");
    }

    // Check for active tasks (cascade delete policy: block)
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    const activeTasks = tasks.filter(
      (t) => t.deletedAt === undefined && t.status !== "ARCHIVED"
    );

    if (activeTasks.length > 0) {
      throw new Error(
        "Cannot archive project with active tasks. Archive or delete the tasks first."
      );
    }

    await ctx.db.patch(project._id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Restore an archived project (admin only)
 *
 * Accepts either a Convex ID or a Supabase UUID (for migration compatibility).
 */
export const restore = mutation({
  args: {
    projectId: v.string(), // Accept string to handle both Convex ID and Supabase UUID
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    // Resolve project - try direct lookup first, then by supabaseId
    let project = await ctx.db
      .get(args.projectId as Id<"projects">)
      .catch(() => null);

    if (!project) {
      // Try looking up by supabaseId (for migration compatibility)
      project = await ctx.db
        .query("projects")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.projectId))
        .first();
    }

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    if (project.deletedAt === undefined) {
      throw new Error("Project is not archived");
    }

    await ctx.db.patch(project._id, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Permanently delete a project (hard delete)
 *
 * Admin only. Project must be archived first.
 * Blocks if project has any tasks or time logs.
 * Accepts either a Convex ID or a Supabase UUID (for migration compatibility).
 */
export const destroy = mutation({
  args: {
    projectId: v.string(), // Accept string to handle both Convex ID and Supabase UUID
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    // Resolve project - try direct lookup first, then by supabaseId
    let project = await ctx.db
      .get(args.projectId as Id<"projects">)
      .catch(() => null);

    if (!project) {
      // Try looking up by supabaseId (for migration compatibility)
      project = await ctx.db
        .query("projects")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.projectId))
        .first();
    }

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    if (project.deletedAt === undefined) {
      throw new Error("Project must be archived before permanent deletion");
    }

    // Check for tasks (block if any exist)
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .first();

    if (tasks) {
      throw new Error("Cannot delete project with associated tasks");
    }

    // Check for time logs (block if any exist)
    const timeLogs = await ctx.db
      .query("timeLogs")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .first();

    if (timeLogs) {
      throw new Error("Cannot delete project with associated time logs");
    }

    // Hard delete the project
    await ctx.db.delete(project._id);

    return { success: true };
  },
});
