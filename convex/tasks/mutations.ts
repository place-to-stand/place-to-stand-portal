/**
 * Task mutations for Convex
 *
 * Provides mutations for creating and managing task records.
 * All mutations require access to the parent project.
 *
 * Cascade delete policy: Tasks are soft-deleted (archived).
 * Hard delete requires task to be archived first.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { requireUser, requireRole, NotFoundError, ForbiddenError, isAdmin } from "../lib/permissions";
import { taskStatusValidator } from "../schema";

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MutationCtx = any;

/**
 * Resolve project - try direct lookup first, then by supabaseId
 */
async function resolveProject(
  ctx: MutationCtx,
  projectId: string
): Promise<Doc<"projects"> | null> {
  try {
    const project = await ctx.db.get(projectId as Id<"projects">);
    if (project && "status" in project) {
      return project;
    }
  } catch {
    // Invalid ID format
  }

  return await ctx.db
    .query("projects")
    .withIndex("by_supabaseId", (q: { eq: (field: string, value: string) => unknown }) => q.eq("supabaseId", projectId))
    .first();
}

/**
 * Resolve task - try direct lookup first, then by supabaseId
 */
async function resolveTask(
  ctx: MutationCtx,
  taskId: string
): Promise<Doc<"tasks"> | null> {
  try {
    const task = await ctx.db.get(taskId as Id<"tasks">);
    if (task && "projectId" in task) {
      return task;
    }
  } catch {
    // Invalid ID format
  }

  return await ctx.db
    .query("tasks")
    .withIndex("by_supabaseId", (q: { eq: (field: string, value: string) => unknown }) => q.eq("supabaseId", taskId))
    .first();
}

/**
 * Resolve user - try direct lookup first, then by supabaseId
 */
async function resolveUser(
  ctx: MutationCtx,
  userId: string
): Promise<Doc<"users"> | null> {
  try {
    const user = await ctx.db.get(userId as Id<"users">);
    if (user && "email" in user) {
      return user;
    }
  } catch {
    // Invalid ID format
  }

  return await ctx.db
    .query("users")
    .withIndex("by_supabaseId", (q: { eq: (field: string, value: string) => unknown }) => q.eq("supabaseId", userId))
    .first();
}

/**
 * Check if user can access project
 */
async function canAccessProject(
  ctx: MutationCtx,
  project: Doc<"projects">,
  user: Doc<"users">
): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (project.type === "INTERNAL") return true;
  if (project.type === "PERSONAL") return project.createdBy === user._id;

  if (project.type === "CLIENT" && project.clientId) {
    const membership = await ctx.db
      .query("clientMembers")
      .withIndex("by_client_user", (q: { eq: (field: string, value: Id<"clients"> | Id<"users">) => { eq: (field: string, value: Id<"users">) => unknown } }) =>
        q.eq("clientId", project.clientId!).eq("userId", user._id)
      )
      .first();
    return membership !== null && membership.deletedAt === undefined;
  }

  return false;
}

/**
 * Generate the next rank for a task in a status column
 * Uses lexicographical ordering for efficient inserts
 */
function generateNextRank(existingRanks: string[]): string {
  if (existingRanks.length === 0) {
    return "a"; // Start with 'a'
  }

  // Find the highest rank
  const sorted = [...existingRanks].sort();
  const lastRank = sorted[sorted.length - 1];

  // Increment the last character
  const lastChar = lastRank.charAt(lastRank.length - 1);
  if (lastChar < "z") {
    return lastRank.slice(0, -1) + String.fromCharCode(lastChar.charCodeAt(0) + 1);
  }

  // If we've reached 'z', append 'a'
  return lastRank + "a";
}

/**
 * Calculate rank between two positions for reordering
 */
function calculateRankBetween(
  beforeRank: string | null,
  afterRank: string | null
): string {
  // If inserting at the start
  if (!beforeRank) {
    if (!afterRank) return "a";
    // Generate rank before afterRank
    const firstChar = afterRank.charAt(0);
    if (firstChar > "a") {
      return String.fromCharCode(firstChar.charCodeAt(0) - 1);
    }
    return "a" + afterRank; // Prepend 'a' if already at 'a'
  }

  // If inserting at the end
  if (!afterRank) {
    return generateNextRank([beforeRank]);
  }

  // Insert between two ranks
  // Simple approach: concatenate middle character
  const midPoint = Math.floor(
    (beforeRank.charCodeAt(beforeRank.length - 1) +
      afterRank.charCodeAt(0)) /
      2
  );

  if (midPoint > beforeRank.charCodeAt(beforeRank.length - 1)) {
    return beforeRank.slice(0, -1) + String.fromCharCode(midPoint);
  }

  // If no space between, extend the rank
  return beforeRank + "n"; // 'n' is middle of alphabet
}

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new task
 *
 * Requires access to the parent project.
 */
export const create = mutation({
  args: {
    projectId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(taskStatusValidator),
    dueOn: v.optional(v.string()),
    assigneeIds: v.optional(v.array(v.string())),
    supabaseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Resolve and verify project access
    const project = await resolveProject(ctx, args.projectId);
    if (!project || project.deletedAt !== undefined) {
      throw new NotFoundError("Project not found");
    }

    if (!(await canAccessProject(ctx, project, user))) {
      throw new ForbiddenError("No access to this project");
    }

    const status = args.status ?? "BACKLOG";

    // Get existing ranks for this status to calculate new rank
    const existingTasks = await ctx.db
      .query("tasks")
      .withIndex("by_project_status", (q) =>
        q.eq("projectId", project._id).eq("status", status)
      )
      .collect();

    const existingRanks = existingTasks
      .filter((t) => t.deletedAt === undefined)
      .map((t) => t.rank);

    const rank = generateNextRank(existingRanks);

    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      projectId: project._id,
      title: args.title,
      description: args.description,
      status,
      rank,
      dueOn: args.dueOn,
      createdBy: user._id,
      updatedBy: user._id,
      createdAt: now,
      updatedAt: now,
      supabaseId: args.supabaseId,
    });

    // Add assignees if provided
    if (args.assigneeIds && args.assigneeIds.length > 0) {
      for (let i = 0; i < args.assigneeIds.length; i++) {
        const assigneeUser = await resolveUser(ctx, args.assigneeIds[i]);
        if (!assigneeUser || assigneeUser.deletedAt !== undefined) continue;

        // Check for existing assignment (uniqueness)
        const existing = await ctx.db
          .query("taskAssignees")
          .withIndex("by_task_user", (q) =>
            q.eq("taskId", taskId).eq("userId", assigneeUser._id)
          )
          .first();

        if (existing && existing.deletedAt === undefined) continue;

        await ctx.db.insert("taskAssignees", {
          taskId,
          userId: assigneeUser._id,
          createdAt: now,
          updatedAt: now,
        });

        // Add sort order metadata (references user directly, not taskAssignee)
        await ctx.db.insert("taskAssigneeMetadata", {
          taskId,
          userId: assigneeUser._id,
          sortOrder: i,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return taskId;
  },
});

/**
 * Update a task
 *
 * Requires access to the parent project.
 */
export const update = mutation({
  args: {
    taskId: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    status: v.optional(taskStatusValidator),
    dueOn: v.optional(v.union(v.string(), v.null())),
    assigneeIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const task = await resolveTask(ctx, args.taskId);
    if (!task || task.deletedAt !== undefined) {
      throw new NotFoundError("Task not found");
    }

    // Verify project access
    const project = await ctx.db.get(task.projectId);
    if (!project || project.deletedAt !== undefined) {
      throw new NotFoundError("Project not found");
    }

    if (!(await canAccessProject(ctx, project, user))) {
      throw new ForbiddenError("No access to this project");
    }

    const now = Date.now();
    const updates: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: user._id,
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description ?? undefined;
    if (args.dueOn !== undefined) updates.dueOn = args.dueOn ?? undefined;

    // Handle status change with rank recalculation
    if (args.status !== undefined && args.status !== task.status) {
      // Get existing ranks for new status
      const existingTasks = await ctx.db
        .query("tasks")
        .withIndex("by_project_status", (q) =>
          q.eq("projectId", task.projectId).eq("status", args.status!)
        )
        .collect();

      const existingRanks = existingTasks
        .filter((t) => t.deletedAt === undefined && t._id !== task._id)
        .map((t) => t.rank);

      updates.status = args.status;
      updates.rank = generateNextRank(existingRanks);
    }

    await ctx.db.patch(task._id, updates);

    // Update assignees if provided
    if (args.assigneeIds !== undefined) {
      // Get current assignees
      const currentAssignees = await ctx.db
        .query("taskAssignees")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .collect();

      const activeAssignees = currentAssignees.filter(
        (a) => a.deletedAt === undefined
      );

      // Resolve new assignee user IDs
      const newAssigneeUsers = await Promise.all(
        args.assigneeIds.map((id) => resolveUser(ctx, id))
      );
      const validNewAssignees = newAssigneeUsers.filter(
        (u): u is Doc<"users"> => u !== null && u.deletedAt === undefined
      );
      const newAssigneeSet = new Set(validNewAssignees.map((u) => u._id.toString()));

      // Soft-delete removed assignees
      for (const assignee of activeAssignees) {
        if (!newAssigneeSet.has(assignee.userId.toString())) {
          await ctx.db.patch(assignee._id, { deletedAt: now, updatedAt: now });
        }
      }

      // Add new assignees
      const currentAssigneeSet = new Set(
        activeAssignees.map((a) => a.userId.toString())
      );

      for (let i = 0; i < validNewAssignees.length; i++) {
        const assigneeUser = validNewAssignees[i];
        if (currentAssigneeSet.has(assigneeUser._id.toString())) continue;

        // Check if soft-deleted assignment exists
        const existingDeleted = currentAssignees.find(
          (a) =>
            a.userId.toString() === assigneeUser._id.toString() &&
            a.deletedAt !== undefined
        );

        if (existingDeleted) {
          // Restore the soft-deleted assignment
          await ctx.db.patch(existingDeleted._id, {
            deletedAt: undefined,
            updatedAt: now,
          });
        } else {
          // Create new assignment
          await ctx.db.insert("taskAssignees", {
            taskId: task._id,
            userId: assigneeUser._id,
            createdAt: now,
            updatedAt: now,
          });
        }

        // Update or create sort order metadata (references user directly)
        const existingMetadata = await ctx.db
          .query("taskAssigneeMetadata")
          .withIndex("by_task_user", (q) =>
            q.eq("taskId", task._id).eq("userId", assigneeUser._id)
          )
          .first();

        if (existingMetadata) {
          await ctx.db.patch(existingMetadata._id, {
            sortOrder: i,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("taskAssigneeMetadata", {
            taskId: task._id,
            userId: assigneeUser._id,
            sortOrder: i,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    return { success: true };
  },
});

/**
 * Update task status only
 *
 * Optimized mutation for drag-drop status changes.
 */
export const updateStatus = mutation({
  args: {
    taskId: v.string(),
    status: taskStatusValidator,
    rank: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const task = await resolveTask(ctx, args.taskId);
    if (!task || task.deletedAt !== undefined) {
      throw new NotFoundError("Task not found");
    }

    // Verify project access
    const project = await ctx.db.get(task.projectId);
    if (!project || project.deletedAt !== undefined) {
      throw new NotFoundError("Project not found");
    }

    if (!(await canAccessProject(ctx, project, user))) {
      throw new ForbiddenError("No access to this project");
    }

    const now = Date.now();
    let newRank = args.rank;

    // If no rank provided and status changed, calculate new rank
    if (!newRank && args.status !== task.status) {
      const existingTasks = await ctx.db
        .query("tasks")
        .withIndex("by_project_status", (q) =>
          q.eq("projectId", task.projectId).eq("status", args.status)
        )
        .collect();

      const existingRanks = existingTasks
        .filter((t) => t.deletedAt === undefined && t._id !== task._id)
        .map((t) => t.rank);

      newRank = generateNextRank(existingRanks);
    }

    await ctx.db.patch(task._id, {
      status: args.status,
      ...(newRank ? { rank: newRank } : {}),
      updatedAt: now,
      updatedBy: user._id,
    });

    return { success: true };
  },
});

/**
 * Reorder a task within its status column
 *
 * Calculates a new rank based on adjacent tasks.
 */
export const reorder = mutation({
  args: {
    taskId: v.string(),
    beforeTaskId: v.optional(v.string()),
    afterTaskId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const task = await resolveTask(ctx, args.taskId);
    if (!task || task.deletedAt !== undefined) {
      throw new NotFoundError("Task not found");
    }

    // Verify project access
    const project = await ctx.db.get(task.projectId);
    if (!project || project.deletedAt !== undefined) {
      throw new NotFoundError("Project not found");
    }

    if (!(await canAccessProject(ctx, project, user))) {
      throw new ForbiddenError("No access to this project");
    }

    // Get ranks of adjacent tasks
    let beforeRank: string | null = null;
    let afterRank: string | null = null;

    if (args.beforeTaskId) {
      const beforeTask = await resolveTask(ctx, args.beforeTaskId);
      if (beforeTask && beforeTask.deletedAt === undefined) {
        beforeRank = beforeTask.rank;
      }
    }

    if (args.afterTaskId) {
      const afterTask = await resolveTask(ctx, args.afterTaskId);
      if (afterTask && afterTask.deletedAt === undefined) {
        afterRank = afterTask.rank;
      }
    }

    const newRank = calculateRankBetween(beforeRank, afterRank);

    await ctx.db.patch(task._id, {
      rank: newRank,
      updatedAt: Date.now(),
      updatedBy: user._id,
    });

    return { success: true };
  },
});

/**
 * Accept a completed task (admin only)
 *
 * Marks a DONE task as accepted.
 */
export const accept = mutation({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    const task = await resolveTask(ctx, args.taskId);
    if (!task || task.deletedAt !== undefined) {
      throw new NotFoundError("Task not found");
    }

    if (task.status !== "DONE") {
      throw new Error("Can only accept DONE tasks");
    }

    if (task.acceptedAt !== undefined) {
      throw new Error("Task is already accepted");
    }

    await ctx.db.patch(task._id, {
      acceptedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Unaccept a task (admin only)
 *
 * Reverts acceptance of a DONE task.
 */
export const unaccept = mutation({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    const task = await resolveTask(ctx, args.taskId);
    if (!task || task.deletedAt !== undefined) {
      throw new NotFoundError("Task not found");
    }

    if (task.status !== "DONE") {
      throw new Error("Can only unaccept DONE tasks");
    }

    if (task.acceptedAt === undefined) {
      throw new Error("Task is not accepted");
    }

    await ctx.db.patch(task._id, {
      acceptedAt: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Archive (soft delete) a task
 *
 * Sets deletedAt timestamp.
 */
export const archive = mutation({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const task = await resolveTask(ctx, args.taskId);
    if (!task) {
      throw new NotFoundError("Task not found");
    }

    if (task.deletedAt !== undefined) {
      throw new Error("Task is already archived");
    }

    // Verify project access
    const project = await ctx.db.get(task.projectId);
    if (!project || project.deletedAt !== undefined) {
      throw new NotFoundError("Project not found");
    }

    if (!(await canAccessProject(ctx, project, user))) {
      throw new ForbiddenError("No access to this project");
    }

    const now = Date.now();

    // Soft-delete the task
    await ctx.db.patch(task._id, {
      deletedAt: now,
      updatedAt: now,
      updatedBy: user._id,
    });

    // Soft-delete associated attachments
    const attachments = await ctx.db
      .query("taskAttachments")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .collect();

    for (const attachment of attachments) {
      if (attachment.deletedAt === undefined) {
        await ctx.db.patch(attachment._id, { deletedAt: now, updatedAt: now });
      }
    }

    return { success: true };
  },
});

/**
 * Restore an archived task (admin only)
 */
export const restore = mutation({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    const task = await resolveTask(ctx, args.taskId);
    if (!task) {
      throw new NotFoundError("Task not found");
    }

    if (task.deletedAt === undefined) {
      throw new Error("Task is not archived");
    }

    // Verify project still exists
    const project = await ctx.db.get(task.projectId);
    if (!project || project.deletedAt !== undefined) {
      throw new Error("Cannot restore task: parent project is archived");
    }

    await ctx.db.patch(task._id, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Permanently delete a task (hard delete, admin only)
 *
 * Task must be archived first.
 * Also deletes all related records (assignees, comments, attachments).
 */
export const destroy = mutation({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, "ADMIN");

    const task = await resolveTask(ctx, args.taskId);
    if (!task) {
      throw new NotFoundError("Task not found");
    }

    if (task.deletedAt === undefined) {
      throw new Error("Task must be archived before permanent deletion");
    }

    // Delete assignees
    const assignees = await ctx.db
      .query("taskAssignees")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .collect();

    for (const assignee of assignees) {
      await ctx.db.delete(assignee._id);
    }

    // Delete assignee metadata
    const metadata = await ctx.db
      .query("taskAssigneeMetadata")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .collect();

    for (const m of metadata) {
      await ctx.db.delete(m._id);
    }

    // Delete comments
    const comments = await ctx.db
      .query("taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .collect();

    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete attachments
    const attachments = await ctx.db
      .query("taskAttachments")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .collect();

    for (const attachment of attachments) {
      await ctx.db.delete(attachment._id);
    }

    // Delete time log links
    const timeLogTasks = await ctx.db
      .query("timeLogTasks")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .collect();

    for (const link of timeLogTasks) {
      await ctx.db.delete(link._id);
    }

    // Finally delete the task
    await ctx.db.delete(task._id);

    return { success: true };
  },
});

// ============================================================
// ASSIGNEE MUTATIONS
// ============================================================

/**
 * Add an assignee to a task
 */
export const addAssignee = mutation({
  args: {
    taskId: v.string(),
    userId: v.string(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const task = await resolveTask(ctx, args.taskId);
    if (!task || task.deletedAt !== undefined) {
      throw new NotFoundError("Task not found");
    }

    // Verify project access
    const project = await ctx.db.get(task.projectId);
    if (!project || project.deletedAt !== undefined) {
      throw new NotFoundError("Project not found");
    }

    if (!(await canAccessProject(ctx, project, user))) {
      throw new ForbiddenError("No access to this project");
    }

    const assigneeUser = await resolveUser(ctx, args.userId);
    if (!assigneeUser || assigneeUser.deletedAt !== undefined) {
      throw new NotFoundError("User not found");
    }

    // Check for existing assignment (uniqueness)
    const existing = await ctx.db
      .query("taskAssignees")
      .withIndex("by_task_user", (q) =>
        q.eq("taskId", task._id).eq("userId", assigneeUser._id)
      )
      .first();

    const now = Date.now();

    if (existing) {
      if (existing.deletedAt === undefined) {
        throw new Error("User is already assigned to this task");
      }
      // Restore soft-deleted assignment
      await ctx.db.patch(existing._id, { deletedAt: undefined, updatedAt: now });
    } else {
      await ctx.db.insert("taskAssignees", {
        taskId: task._id,
        userId: assigneeUser._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Get or calculate sort order
    let sortOrder = args.sortOrder;
    if (sortOrder === undefined) {
      const existingMetadata = await ctx.db
        .query("taskAssigneeMetadata")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .collect();
      sortOrder = existingMetadata.length;
    }

    // Create or update metadata (references user directly)
    const existingMeta = await ctx.db
      .query("taskAssigneeMetadata")
      .withIndex("by_task_user", (q) =>
        q.eq("taskId", task._id).eq("userId", assigneeUser._id)
      )
      .first();

    if (existingMeta) {
      await ctx.db.patch(existingMeta._id, { sortOrder, updatedAt: now });
    } else {
      await ctx.db.insert("taskAssigneeMetadata", {
        taskId: task._id,
        userId: assigneeUser._id,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Remove an assignee from a task (soft delete)
 */
export const removeAssignee = mutation({
  args: {
    taskId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const task = await resolveTask(ctx, args.taskId);
    if (!task || task.deletedAt !== undefined) {
      throw new NotFoundError("Task not found");
    }

    // Verify project access
    const project = await ctx.db.get(task.projectId);
    if (!project || project.deletedAt !== undefined) {
      throw new NotFoundError("Project not found");
    }

    if (!(await canAccessProject(ctx, project, user))) {
      throw new ForbiddenError("No access to this project");
    }

    const assigneeUser = await resolveUser(ctx, args.userId);
    if (!assigneeUser) {
      throw new NotFoundError("User not found");
    }

    const assignment = await ctx.db
      .query("taskAssignees")
      .withIndex("by_task_user", (q) =>
        q.eq("taskId", task._id).eq("userId", assigneeUser._id)
      )
      .first();

    if (!assignment || assignment.deletedAt !== undefined) {
      throw new NotFoundError("Assignment not found");
    }

    await ctx.db.patch(assignment._id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================================
// COMMENT MUTATIONS
// ============================================================

/**
 * Add a comment to a task
 */
export const addComment = mutation({
  args: {
    taskId: v.string(),
    body: v.string(),
    supabaseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const task = await resolveTask(ctx, args.taskId);
    if (!task || task.deletedAt !== undefined) {
      throw new NotFoundError("Task not found");
    }

    // Verify project access
    const project = await ctx.db.get(task.projectId);
    if (!project || project.deletedAt !== undefined) {
      throw new NotFoundError("Project not found");
    }

    if (!(await canAccessProject(ctx, project, user))) {
      throw new ForbiddenError("No access to this project");
    }

    const now = Date.now();
    const commentId = await ctx.db.insert("taskComments", {
      taskId: task._id,
      authorId: user._id,
      body: args.body,
      createdAt: now,
      updatedAt: now,
      supabaseId: args.supabaseId,
    });

    return { commentId };
  },
});

/**
 * Update a comment
 */
export const updateComment = mutation({
  args: {
    commentId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Resolve comment
    let comment: Doc<"taskComments"> | null = null;
    try {
      comment = await ctx.db.get(args.commentId as Id<"taskComments">);
    } catch {
      comment = await ctx.db
        .query("taskComments")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.commentId))
        .first();
    }

    if (!comment || comment.deletedAt !== undefined) {
      throw new NotFoundError("Comment not found");
    }

    // Only author or admin can edit
    if (comment.authorId !== user._id && !isAdmin(user)) {
      throw new ForbiddenError("Can only edit your own comments");
    }

    await ctx.db.patch(comment._id, {
      body: args.body,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Delete a comment (soft delete)
 */
export const deleteComment = mutation({
  args: { commentId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Resolve comment
    let comment: Doc<"taskComments"> | null = null;
    try {
      comment = await ctx.db.get(args.commentId as Id<"taskComments">);
    } catch {
      comment = await ctx.db
        .query("taskComments")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.commentId))
        .first();
    }

    if (!comment || comment.deletedAt !== undefined) {
      throw new NotFoundError("Comment not found");
    }

    // Only author or admin can delete
    if (comment.authorId !== user._id && !isAdmin(user)) {
      throw new ForbiddenError("Can only delete your own comments");
    }

    await ctx.db.patch(comment._id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================================
// ATTACHMENT MUTATIONS
// ============================================================

/**
 * Add an attachment to a task
 */
export const addAttachment = mutation({
  args: {
    taskId: v.string(),
    storagePath: v.string(),
    originalName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    supabaseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const task = await resolveTask(ctx, args.taskId);
    if (!task || task.deletedAt !== undefined) {
      throw new NotFoundError("Task not found");
    }

    // Verify project access
    const project = await ctx.db.get(task.projectId);
    if (!project || project.deletedAt !== undefined) {
      throw new NotFoundError("Project not found");
    }

    if (!(await canAccessProject(ctx, project, user))) {
      throw new ForbiddenError("No access to this project");
    }

    const now = Date.now();
    const attachmentId = await ctx.db.insert("taskAttachments", {
      taskId: task._id,
      uploadedBy: user._id,
      storagePath: args.storagePath,
      originalName: args.originalName,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      createdAt: now,
      updatedAt: now,
      supabaseId: args.supabaseId,
    });

    return { attachmentId };
  },
});

/**
 * Delete an attachment (soft delete)
 */
export const deleteAttachment = mutation({
  args: { attachmentId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Resolve attachment
    let attachment: Doc<"taskAttachments"> | null = null;
    try {
      attachment = await ctx.db.get(args.attachmentId as Id<"taskAttachments">);
    } catch {
      attachment = await ctx.db
        .query("taskAttachments")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.attachmentId))
        .first();
    }

    if (!attachment || attachment.deletedAt !== undefined) {
      throw new NotFoundError("Attachment not found");
    }

    // Verify project access
    const task = await ctx.db.get(attachment.taskId);
    if (!task || task.deletedAt !== undefined) {
      throw new NotFoundError("Task not found");
    }

    const project = await ctx.db.get(task.projectId);
    if (!project || project.deletedAt !== undefined) {
      throw new NotFoundError("Project not found");
    }

    if (!(await canAccessProject(ctx, project, user))) {
      throw new ForbiddenError("No access to this project");
    }

    await ctx.db.patch(attachment._id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
