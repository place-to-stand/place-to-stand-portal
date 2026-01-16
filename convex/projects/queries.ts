/**
 * Project queries for Convex
 *
 * Provides queries for fetching project data with permission enforcement.
 * All queries respect soft deletes and enforce project access control.
 *
 * Permission model:
 * - INTERNAL projects: visible to all authenticated users
 * - PERSONAL projects: visible only to the creator
 * - CLIENT projects: visible to admins and client members
 */

import { query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { requireUser, isAdmin } from "../lib/permissions";

/**
 * Check if user can access a project based on type and ownership
 */
async function canAccessProject(
  ctx: QueryCtx,
  project: Doc<"projects">,
  user: Doc<"users">
): Promise<boolean> {
  // Admins can access everything
  if (isAdmin(user)) {
    return true;
  }

  // INTERNAL projects are visible to all authenticated users
  if (project.type === "INTERNAL") {
    return true;
  }

  // PERSONAL projects are only visible to their creator
  if (project.type === "PERSONAL") {
    return project.createdBy === user._id;
  }

  // CLIENT projects require client membership
  if (project.type === "CLIENT" && project.clientId) {
    const membership = await ctx.db
      .query("clientMembers")
      .withIndex("by_client_user", (q) =>
        q.eq("clientId", project.clientId!).eq("userId", user._id)
      )
      .first();

    return membership !== null && membership.deletedAt === undefined;
  }

  return false;
}

/**
 * List all accessible projects for the current user
 *
 * Admins see all non-deleted projects.
 * Non-admins see projects based on type and membership.
 * Results are sorted alphabetically by name.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Fetch all non-deleted projects
    const allProjects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Filter by access permissions
    const accessibleProjects = [];
    for (const project of allProjects) {
      if (await canAccessProject(ctx, project, user)) {
        accessibleProjects.push(project);
      }
    }

    // Sort alphabetically by name (case-insensitive)
    return accessibleProjects.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  },
});

/**
 * List projects by type
 *
 * Filters projects by type (CLIENT, PERSONAL, INTERNAL).
 * Respects access permissions.
 */
export const listByType = query({
  args: {
    type: v.union(
      v.literal("CLIENT"),
      v.literal("PERSONAL"),
      v.literal("INTERNAL")
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Fetch projects of the specified type
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .collect();

    // Filter for non-deleted and accessible
    const accessibleProjects = [];
    for (const project of projects) {
      if (project.deletedAt === undefined) {
        if (await canAccessProject(ctx, project, user)) {
          accessibleProjects.push(project);
        }
      }
    }

    // Sort alphabetically
    return accessibleProjects.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  },
});

/**
 * List projects for a specific client
 *
 * Returns all non-deleted projects belonging to the client.
 * Requires access to the client.
 */
export const listByClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Check client exists and user has access
    const client = await ctx.db.get(args.clientId);
    if (!client || client.deletedAt !== undefined) {
      return [];
    }

    // Check client access for non-admins
    if (!isAdmin(user)) {
      const membership = await ctx.db
        .query("clientMembers")
        .withIndex("by_client_user", (q) =>
          q.eq("clientId", args.clientId).eq("userId", user._id)
        )
        .first();

      if (!membership || membership.deletedAt !== undefined) {
        return [];
      }
    }

    // Fetch all projects for this client
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    // Filter non-deleted
    const activeProjects = projects.filter((p) => p.deletedAt === undefined);

    // Sort alphabetically
    return activeProjects.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  },
});

/**
 * Get a project by ID
 *
 * Requires access to the project. Returns null if not found or no access.
 */
export const getById = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const project = await ctx.db.get(args.projectId);

    if (!project || project.deletedAt !== undefined) {
      return null;
    }

    // Check access
    if (!(await canAccessProject(ctx, project, user))) {
      return null;
    }

    return project;
  },
});

/**
 * Get a project by slug
 *
 * Requires access to the project. Returns null if not found or no access.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const project = await ctx.db
      .query("projects")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!project || project.deletedAt !== undefined) {
      return null;
    }

    // Check access
    if (!(await canAccessProject(ctx, project, user))) {
      return null;
    }

    return project;
  },
});

/**
 * Get a project by slug with client info
 *
 * Returns the project along with its client (if CLIENT type).
 */
export const getBySlugWithClient = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const project = await ctx.db
      .query("projects")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!project || project.deletedAt !== undefined) {
      return null;
    }

    // Check access
    if (!(await canAccessProject(ctx, project, user))) {
      return null;
    }

    // Fetch client if CLIENT type
    let client = null;
    if (project.clientId) {
      client = await ctx.db.get(project.clientId);
      if (client?.deletedAt !== undefined) {
        client = null;
      }
    }

    return {
      ...project,
      client,
    };
  },
});

/**
 * List projects with task counts
 *
 * Returns projects with aggregated task metrics.
 * Used by settings pages and dashboards.
 */
export const listWithTaskCounts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Fetch all non-deleted projects
    const allProjects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Filter by access permissions
    const accessibleProjects = [];
    for (const project of allProjects) {
      if (await canAccessProject(ctx, project, user)) {
        accessibleProjects.push(project);
      }
    }

    // For each project, count tasks
    const projectsWithCounts = await Promise.all(
      accessibleProjects.map(async (project) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();

        const activeTasks = tasks.filter(
          (t) => t.deletedAt === undefined && t.status !== "ARCHIVED"
        );
        const doneTasks = tasks.filter(
          (t) => t.deletedAt === undefined && t.status === "DONE"
        );

        return {
          ...project,
          taskCount: activeTasks.length,
          doneTaskCount: doneTasks.length,
        };
      })
    );

    // Sort alphabetically
    return projectsWithCounts.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  },
});

/**
 * List projects for a client with task counts
 *
 * Returns all non-deleted projects for a client with task statistics.
 * Used by the client detail page.
 * Accepts client ID as string (Convex ID or Supabase UUID).
 */
export const listForClientWithTaskCounts = query({
  args: {
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Resolve client - try direct lookup first, then by supabaseId
    let client: Doc<"clients"> | null = null;

    try {
      const directLookup = await ctx.db.get(args.clientId as Id<"clients">);
      // Verify it's actually a client by checking for expected fields
      if (directLookup && "billingType" in directLookup) {
        client = directLookup as Doc<"clients">;
      }
    } catch {
      // Invalid ID format, try supabaseId lookup
    }

    if (!client) {
      client = await ctx.db
        .query("clients")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.clientId))
        .first();
    }

    if (!client || client.deletedAt !== undefined) {
      return [];
    }

    // Check client access for non-admins
    if (!isAdmin(user)) {
      const membership = await ctx.db
        .query("clientMembers")
        .withIndex("by_client_user", (q) =>
          q.eq("clientId", client!._id).eq("userId", user._id)
        )
        .first();

      if (!membership || membership.deletedAt !== undefined) {
        return [];
      }
    }

    // Fetch all projects for this client
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_client", (q) => q.eq("clientId", client!._id))
      .collect();

    // Filter non-deleted
    const activeProjects = projects.filter((p) => p.deletedAt === undefined);

    // For each project, count tasks
    const projectsWithCounts = await Promise.all(
      activeProjects.map(async (project) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();

        const activeTasks = tasks.filter(
          (t) => t.deletedAt === undefined && t.status !== "ARCHIVED"
        );
        const doneTasks = tasks.filter(
          (t) => t.deletedAt === undefined && t.status === "DONE"
        );

        return {
          ...project,
          totalTasks: activeTasks.length,
          doneTasks: doneTasks.length,
        };
      })
    );

    // Sort alphabetically
    return projectsWithCounts.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  },
});

/**
 * List archived (soft-deleted) projects
 *
 * Admin only. Returns projects where deletedAt is set.
 * Used by the archive management page.
 */
export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Admin only for archived projects
    if (!isAdmin(user)) {
      return [];
    }

    // Get archived projects (deletedAt is set)
    const allProjects = await ctx.db.query("projects").collect();
    const archivedProjects = allProjects.filter(
      (p) => p.deletedAt !== undefined
    );

    // Sort alphabetically
    return archivedProjects.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  },
});
