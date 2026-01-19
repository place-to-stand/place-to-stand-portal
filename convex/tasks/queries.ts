/**
 * Task queries for Convex
 *
 * Provides queries for fetching task data with permission enforcement.
 * All queries respect soft deletes and enforce project-level access control.
 *
 * Permission model:
 * - Tasks inherit access from their parent project
 * - User must have access to the project to see its tasks
 *
 * Real-time: These queries support Convex subscriptions for live updates.
 */

import { query, type QueryCtx } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { requireUser, isAdmin } from "../lib/permissions";
import { taskStatusValidator } from "../schema";

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if user can access a project based on type and ownership
 * (Duplicated from projects/queries.ts for co-location)
 */
async function canAccessProject(
  ctx: QueryCtx,
  project: Doc<"projects">,
  user: Doc<"users">
): Promise<boolean> {
  if (isAdmin(user)) {
    return true;
  }

  if (project.type === "INTERNAL") {
    return true;
  }

  if (project.type === "PERSONAL") {
    return project.createdBy === user._id;
  }

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
 * Resolve project - try direct lookup first, then by supabaseId
 */
async function resolveProject(
  ctx: QueryCtx,
  projectId: string
): Promise<Doc<"projects"> | null> {
  // Try direct Convex ID lookup
  try {
    const project = await ctx.db.get(projectId as Id<"projects">);
    if (project && "status" in project) {
      return project;
    }
  } catch {
    // Invalid ID format, continue to supabaseId lookup
  }

  // Fall back to supabaseId lookup
  return await ctx.db
    .query("projects")
    .withIndex("by_supabaseId", (q) => q.eq("supabaseId", projectId))
    .first();
}

/**
 * Resolve task - try direct lookup first, then by supabaseId
 */
async function resolveTask(
  ctx: QueryCtx,
  taskId: string
): Promise<Doc<"tasks"> | null> {
  // Try direct Convex ID lookup
  try {
    const task = await ctx.db.get(taskId as Id<"tasks">);
    if (task && "projectId" in task) {
      return task;
    }
  } catch {
    // Invalid ID format, continue to supabaseId lookup
  }

  // Fall back to supabaseId lookup
  return await ctx.db
    .query("tasks")
    .withIndex("by_supabaseId", (q) => q.eq("supabaseId", taskId))
    .first();
}

// ============================================================
// QUERIES
// ============================================================

/**
 * List all tasks for a project
 *
 * Returns non-deleted, non-archived tasks sorted by rank within each status.
 * Requires access to the project.
 */
export const listByProject = query({
  args: {
    projectId: v.string(),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Resolve and verify project access
    const project = await resolveProject(ctx, args.projectId);
    if (!project || project.deletedAt !== undefined) {
      return [];
    }

    if (!(await canAccessProject(ctx, project, user))) {
      return [];
    }

    // Fetch all tasks for this project
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    // Filter based on options
    const filteredTasks = tasks.filter((t) => {
      // Always exclude deleted
      if (t.deletedAt !== undefined) return false;

      // Optionally exclude archived status
      if (!args.includeArchived && t.status === "ARCHIVED") return false;

      return true;
    });

    // Sort by status then rank
    return filteredTasks.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status.localeCompare(b.status);
      }
      return a.rank.localeCompare(b.rank);
    });
  },
});

/**
 * List tasks by project with relations (assignees, counts)
 *
 * Returns tasks with their assignees, comment counts, and attachment counts.
 * Used by the kanban board view.
 */
export const listByProjectWithRelations = query({
  args: {
    projectId: v.string(),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Resolve and verify project access
    const project = await resolveProject(ctx, args.projectId);
    if (!project || project.deletedAt !== undefined) {
      return [];
    }

    if (!(await canAccessProject(ctx, project, user))) {
      return [];
    }

    // Fetch all tasks for this project
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    // Filter based on options
    const filteredTasks = tasks.filter((t) => {
      if (t.deletedAt !== undefined) return false;
      if (!args.includeArchived && t.status === "ARCHIVED") return false;
      return true;
    });

    // Enrich each task with relations
    const enrichedTasks = await Promise.all(
      filteredTasks.map(async (task) => {
        // Get assignees
        const assignees = await ctx.db
          .query("taskAssignees")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .collect();

        const activeAssignees = assignees.filter(
          (a) => a.deletedAt === undefined
        );

        // Get assignee user details
        const assigneeUsers = await Promise.all(
          activeAssignees.map(async (a) => {
            const user = await ctx.db.get(a.userId);
            return user
              ? {
                  id: user.supabaseId ?? user._id,
                  email: user.email,
                  fullName: user.fullName,
                  avatarUrl: user.avatarUrl,
                }
              : null;
          })
        );

        // Count comments
        const comments = await ctx.db
          .query("taskComments")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .collect();
        const commentCount = comments.filter(
          (c) => c.deletedAt === undefined
        ).length;

        // Count attachments
        const attachments = await ctx.db
          .query("taskAttachments")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .collect();
        const attachmentCount = attachments.filter(
          (a) => a.deletedAt === undefined
        ).length;

        return {
          ...task,
          id: task.supabaseId ?? task._id,
          // Return the project's supabaseId for UI compatibility
          projectSupabaseId: project.supabaseId ?? project._id,
          assignees: assigneeUsers.filter(Boolean),
          commentCount,
          attachmentCount,
        };
      })
    );

    // Sort by status then rank
    return enrichedTasks.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status.localeCompare(b.status);
      }
      return a.rank.localeCompare(b.rank);
    });
  },
});

/**
 * List tasks by project with pagination
 *
 * For large projects, supports cursor-based pagination.
 */
export const listByProjectPaginated = query({
  args: {
    projectId: v.string(),
    status: v.optional(taskStatusValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Resolve and verify project access
    const project = await resolveProject(ctx, args.projectId);
    if (!project || project.deletedAt !== undefined) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    if (!(await canAccessProject(ctx, project, user))) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    // Use index based on whether status is filtered
    let query;
    if (args.status) {
      query = ctx.db
        .query("tasks")
        .withIndex("by_project_status", (q) =>
          q.eq("projectId", project._id).eq("status", args.status!)
        );
    } else {
      query = ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", project._id));
    }

    const results = await query.paginate(args.paginationOpts);

    // Filter out deleted tasks
    const filteredPage = results.page.filter((t) => t.deletedAt === undefined);

    return {
      ...results,
      page: filteredPage,
    };
  },
});

/**
 * Get a single task by ID
 *
 * Requires access to the parent project.
 * Accepts Convex ID or Supabase UUID.
 */
export const getById = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const task = await resolveTask(ctx, args.taskId);
    if (!task || task.deletedAt !== undefined) {
      return null;
    }

    // Verify project access
    const project = await ctx.db.get(task.projectId);
    if (!project || project.deletedAt !== undefined) {
      return null;
    }

    if (!(await canAccessProject(ctx, project, user))) {
      return null;
    }

    return task;
  },
});

/**
 * Get a task by ID with all relations
 *
 * Returns the task with assignees, comments, and attachments.
 * Used for the task detail view.
 */
export const getByIdWithRelations = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const task = await resolveTask(ctx, args.taskId);
    if (!task || task.deletedAt !== undefined) {
      return null;
    }

    // Verify project access
    const project = await ctx.db.get(task.projectId);
    if (!project || project.deletedAt !== undefined) {
      return null;
    }

    if (!(await canAccessProject(ctx, project, user))) {
      return null;
    }

    // Get assignees with user details
    const assignees = await ctx.db
      .query("taskAssignees")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .collect();

    const activeAssignees = assignees.filter((a) => a.deletedAt === undefined);

    // Get assignee metadata for sort order (keyed by userId)
    const metadata = await ctx.db
      .query("taskAssigneeMetadata")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .collect();

    // Build lookup map - use userId if available, else skip (legacy data)
    const metadataMap = new Map<string, number>();
    for (const m of metadata) {
      if (m.userId) {
        metadataMap.set(m.userId.toString(), m.sortOrder);
      }
    }

    const assigneeUsers = await Promise.all(
      activeAssignees.map(async (a) => {
        const user = await ctx.db.get(a.userId);
        return user
          ? {
              id: user.supabaseId ?? user._id,
              email: user.email,
              fullName: user.fullName,
              avatarUrl: user.avatarUrl,
              sortOrder: metadataMap.get(a.userId.toString()) ?? 0,
            }
          : null;
      })
    );

    // Sort assignees by sortOrder
    const sortedAssignees = assigneeUsers
      .filter(Boolean)
      .sort((a, b) => (a!.sortOrder ?? 0) - (b!.sortOrder ?? 0));

    // Get comments
    const comments = await ctx.db
      .query("taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .collect();

    const activeComments = comments.filter((c) => c.deletedAt === undefined);

    // Enrich comments with author info
    const enrichedComments = await Promise.all(
      activeComments.map(async (c) => {
        const author = await ctx.db.get(c.authorId);
        return {
          id: c.supabaseId ?? c._id,
          body: c.body,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          author: author
            ? {
                id: author.supabaseId ?? author._id,
                email: author.email,
                fullName: author.fullName,
                avatarUrl: author.avatarUrl,
              }
            : null,
        };
      })
    );

    // Get attachments
    const attachments = await ctx.db
      .query("taskAttachments")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .collect();

    const activeAttachments = attachments
      .filter((a) => a.deletedAt === undefined)
      .map((a) => ({
        id: a.supabaseId ?? a._id,
        storagePath: a.storagePath,
        originalName: a.originalName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        createdAt: a.createdAt,
      }));

    return {
      ...task,
      id: task.supabaseId ?? task._id,
      project: {
        id: project.supabaseId ?? project._id,
        name: project.name,
        slug: project.slug,
        type: project.type,
        clientId: project.clientId
          ? ((await ctx.db.get(project.clientId))?.supabaseId ??
            project.clientId)
          : null,
      },
      assignees: sortedAssignees,
      comments: enrichedComments.sort((a, b) => a.createdAt - b.createdAt),
      attachments: activeAttachments.sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

/**
 * List tasks assigned to the current user
 *
 * Returns tasks across all accessible projects.
 * Used by the "My Tasks" view.
 */
export const listForCurrentUser = query({
  args: {
    includeCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Get all task assignments for this user
    const assignments = await ctx.db
      .query("taskAssignees")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const activeAssignments = assignments.filter(
      (a) => a.deletedAt === undefined
    );

    // Get the tasks and filter
    const tasks = await Promise.all(
      activeAssignments.map(async (a) => {
        const task = await ctx.db.get(a.taskId);
        if (!task || task.deletedAt !== undefined) return null;

        // Filter by completion status
        if (!args.includeCompleted) {
          if (task.status === "DONE" || task.status === "ARCHIVED") return null;
        }

        // Verify project access
        const project = await ctx.db.get(task.projectId);
        if (!project || project.deletedAt !== undefined) return null;

        if (!(await canAccessProject(ctx, project, user))) return null;

        // Get assignee metadata for sort order (keyed by userId)
        const metadata = await ctx.db
          .query("taskAssigneeMetadata")
          .withIndex("by_task_user", (q) =>
            q.eq("taskId", task._id).eq("userId", a.userId)
          )
          .first();

        return {
          ...task,
          id: task.supabaseId ?? task._id,
          sortOrder: metadata?.sortOrder ?? 0,
          project: {
            id: project.supabaseId ?? project._id,
            name: project.name,
            slug: project.slug,
            type: project.type,
          },
        };
      })
    );

    // Filter nulls and sort by sortOrder, then by dueOn
    return tasks
      .filter(Boolean)
      .sort((a, b) => {
        // First by sortOrder
        if (a!.sortOrder !== b!.sortOrder) {
          return a!.sortOrder - b!.sortOrder;
        }
        // Then by dueOn (nulls last)
        if (a!.dueOn && b!.dueOn) {
          return a!.dueOn.localeCompare(b!.dueOn);
        }
        if (a!.dueOn) return -1;
        if (b!.dueOn) return 1;
        return 0;
      });
  },
});

/**
 * Get task collections for a project (active, accepted, archived)
 *
 * Groups tasks into three collections for different views.
 */
export const getProjectTaskCollections = query({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Resolve and verify project access
    const project = await resolveProject(ctx, args.projectId);
    if (!project || project.deletedAt !== undefined) {
      return { active: [], accepted: [], archived: [] };
    }

    if (!(await canAccessProject(ctx, project, user))) {
      return { active: [], accepted: [], archived: [] };
    }

    // Fetch all tasks for this project
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    // Get assignees for all tasks
    const taskAssignees = await ctx.db
      .query("taskAssignees")
      .withIndex("by_task")
      .collect();

    const assigneesByTask = new Map<string, typeof taskAssignees>();
    for (const a of taskAssignees) {
      if (a.deletedAt !== undefined) continue;
      const key = a.taskId.toString();
      const existing = assigneesByTask.get(key) ?? [];
      existing.push(a);
      assigneesByTask.set(key, existing);
    }

    // Categorize and enrich tasks
    const active: Array<Doc<"tasks"> & { assignees: Array<{ id: string }> }> = [];
    const accepted: Array<Doc<"tasks"> & { assignees: Array<{ id: string }> }> = [];
    const archived: Array<Doc<"tasks"> & { assignees: Array<{ id: string }> }> = [];

    for (const task of tasks) {
      if (task.deletedAt !== undefined) continue;

      const taskAssigneeList = assigneesByTask.get(task._id.toString()) ?? [];
      const assigneeIds = await Promise.all(
        taskAssigneeList.map(async (a) => {
          const user = await ctx.db.get(a.userId);
          return { id: user?.supabaseId ?? a.userId };
        })
      );

      const enrichedTask = {
        ...task,
        id: task.supabaseId ?? task._id,
        assignees: assigneeIds,
      };

      if (task.status === "ARCHIVED") {
        archived.push(enrichedTask);
      } else if (task.acceptedAt !== undefined) {
        accepted.push(enrichedTask);
      } else {
        active.push(enrichedTask);
      }
    }

    // Sort each collection by rank
    const sortByRank = (a: Doc<"tasks">, b: Doc<"tasks">) =>
      a.rank.localeCompare(b.rank);

    return {
      active: active.sort(sortByRank),
      accepted: accepted.sort(sortByRank),
      archived: archived.sort(sortByRank),
    };
  },
});

/**
 * Count tasks by status for a project
 *
 * Used for dashboard metrics and project summary.
 */
export const countByProjectStatus = query({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Resolve and verify project access
    const project = await resolveProject(ctx, args.projectId);
    if (!project || project.deletedAt !== undefined) {
      return {};
    }

    if (!(await canAccessProject(ctx, project, user))) {
      return {};
    }

    // Fetch all tasks for this project
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    // Count by status
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      if (task.deletedAt !== undefined) continue;
      counts[task.status] = (counts[task.status] ?? 0) + 1;
    }

    return counts;
  },
});
