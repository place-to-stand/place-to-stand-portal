/**
 * Permission helpers for Convex functions
 *
 * Ported from lib/auth/permissions.ts to work with Convex's query context.
 * These functions enforce the same access control rules as the Supabase version.
 */

import { ConvexError } from "convex/values";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { USER_ROLE, PROJECT_TYPE } from "./validators";

// ============================================================
// TYPES
// ============================================================

type Ctx = QueryCtx | MutationCtx;

/**
 * User document type for permission checks
 */
export type ConvexUser = Doc<"users">;

// ============================================================
// ERROR CLASSES
// ============================================================

/**
 * Thrown when user lacks permission
 */
export class ForbiddenError extends ConvexError<string> {
  constructor(message: string = "Forbidden") {
    super(message);
  }
}

/**
 * Thrown when resource not found
 */
export class NotFoundError extends ConvexError<string> {
  constructor(message: string = "Not found") {
    super(message);
  }
}

/**
 * Thrown when user not authenticated
 */
export class UnauthorizedError extends ConvexError<string> {
  constructor(message: string = "Unauthorized") {
    super(message);
  }
}

// ============================================================
// ROLE CHECKS
// ============================================================

/**
 * Check if user has admin role
 */
export function isAdmin(user: ConvexUser | null | undefined): boolean {
  return !!user && user.role === USER_ROLE.ADMIN;
}

/**
 * Assert user is admin, throw if not
 */
export function assertAdmin(user: ConvexUser): void {
  if (!isAdmin(user)) {
    throw new ForbiddenError("Admin privileges required");
  }
}

/**
 * Assert user is accessing their own record
 */
export function assertIsSelf(
  user: ConvexUser,
  targetUserId: Id<"users">
): void {
  if (isAdmin(user)) {
    return;
  }

  if (user._id !== targetUserId) {
    throw new ForbiddenError("Insufficient permissions to access user");
  }
}

// ============================================================
// CLIENT ACCESS
// ============================================================

/**
 * Ensure user has access to a client
 * - Admins: always have access
 * - Others: must be a member of the client
 */
export async function ensureClientAccess(
  ctx: Ctx,
  user: ConvexUser,
  clientId: Id<"clients">
): Promise<void> {
  if (isAdmin(user)) {
    return;
  }

  const membership = await ctx.db
    .query("clientMembers")
    .withIndex("by_client_user", (q) =>
      q.eq("clientId", clientId).eq("userId", user._id)
    )
    .first();

  if (!membership) {
    throw new ForbiddenError("Insufficient permissions to access client");
  }
}

/**
 * Ensure user has access to a project's client
 * - Admins: always have access
 * - PERSONAL projects: only creator has access
 * - INTERNAL projects: all users have access
 * - CLIENT projects: must be member of the client
 */
export async function ensureClientAccessByProjectId(
  ctx: Ctx,
  user: ConvexUser,
  projectId: Id<"projects">
): Promise<void> {
  const project = await ctx.db.get(projectId);

  if (!project || project.deletedAt !== undefined) {
    throw new NotFoundError("Project not found");
  }

  // PERSONAL projects: only creator or admin
  if (project.type === PROJECT_TYPE.PERSONAL) {
    if (!isAdmin(user) && project.createdBy !== user._id) {
      throw new ForbiddenError("Insufficient permissions to access project");
    }
    return;
  }

  // INTERNAL projects: all authenticated users
  if (project.type === PROJECT_TYPE.INTERNAL) {
    return;
  }

  // CLIENT projects: check client membership
  if (project.clientId) {
    await ensureClientAccess(ctx, user, project.clientId);
    return;
  }

  // Fallback: admin only
  if (!isAdmin(user)) {
    throw new ForbiddenError("Insufficient permissions to access project");
  }
}

/**
 * Ensure user has access to a task's project
 */
export async function ensureClientAccessByTaskId(
  ctx: Ctx,
  user: ConvexUser,
  taskId: Id<"tasks">,
  options: { includeArchived?: boolean } = {}
): Promise<void> {
  const { includeArchived = false } = options;

  const task = await ctx.db.get(taskId);

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  if (!includeArchived && task.deletedAt !== undefined) {
    throw new NotFoundError("Task not found");
  }

  await ensureClientAccessByProjectId(ctx, user, task.projectId);
}

/**
 * Ensure user has access via task comment
 */
export async function ensureClientAccessByTaskCommentId(
  ctx: Ctx,
  user: ConvexUser,
  taskCommentId: Id<"taskComments">
): Promise<void> {
  const comment = await ctx.db.get(taskCommentId);

  if (!comment || comment.deletedAt !== undefined) {
    throw new NotFoundError("Task comment not found");
  }

  await ensureClientAccessByTaskId(ctx, user, comment.taskId);
}

/**
 * Ensure user has access via time log
 */
export async function ensureClientAccessByTimeLogId(
  ctx: Ctx,
  user: ConvexUser,
  timeLogId: Id<"timeLogs">
): Promise<void> {
  const timeLog = await ctx.db.get(timeLogId);

  if (!timeLog || timeLog.deletedAt !== undefined) {
    throw new NotFoundError("Time log not found");
  }

  await ensureClientAccessByProjectId(ctx, user, timeLog.projectId);
}

/**
 * Ensure user has access via task attachment
 */
export async function ensureClientAccessByTaskAttachmentId(
  ctx: Ctx,
  user: ConvexUser,
  attachmentId: Id<"taskAttachments">
): Promise<void> {
  const attachment = await ctx.db.get(attachmentId);

  if (!attachment || attachment.deletedAt !== undefined) {
    throw new NotFoundError("Task attachment not found");
  }

  await ensureClientAccessByTaskId(ctx, user, attachment.taskId);
}

// ============================================================
// LIST ACCESSIBLE IDS
// ============================================================

/**
 * Get all client IDs user can access
 * - Admins: all non-deleted clients
 * - Others: clients they're members of
 */
export async function listAccessibleClientIds(
  ctx: Ctx,
  user: ConvexUser
): Promise<Id<"clients">[]> {
  if (isAdmin(user)) {
    const clients = await ctx.db
      .query("clients")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return clients.map((c) => c._id);
  }

  const memberships = await ctx.db
    .query("clientMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();

  return memberships.map((m) => m.clientId);
}

/**
 * Get all project IDs user can access
 * - Admins: all non-deleted projects
 * - Others: projects in accessible clients + their PERSONAL + INTERNAL
 */
export async function listAccessibleProjectIds(
  ctx: Ctx,
  user: ConvexUser
): Promise<Id<"projects">[]> {
  if (isAdmin(user)) {
    const projects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return projects.map((p) => p._id);
  }

  const clientIds = await listAccessibleClientIds(ctx, user);

  // Get CLIENT projects user has access to
  const clientProjects: Doc<"projects">[] = [];
  for (const clientId of clientIds) {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_client_deleted", (q) =>
        q.eq("clientId", clientId).eq("deletedAt", undefined)
      )
      .collect();
    clientProjects.push(...projects);
  }

  // Get user's PERSONAL projects
  const personalProjects = await ctx.db
    .query("projects")
    .withIndex("by_createdBy", (q) => q.eq("createdBy", user._id))
    .filter((q) =>
      q.and(
        q.eq(q.field("type"), PROJECT_TYPE.PERSONAL),
        q.eq(q.field("deletedAt"), undefined)
      )
    )
    .collect();

  // Get all INTERNAL projects
  const internalProjects = await ctx.db
    .query("projects")
    .withIndex("by_type", (q) => q.eq("type", PROJECT_TYPE.INTERNAL))
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .collect();

  // Combine and dedupe
  const allProjects = [
    ...clientProjects,
    ...personalProjects,
    ...internalProjects,
  ];
  const uniqueIds = Array.from(new Set(allProjects.map((p) => p._id)));

  return uniqueIds;
}

/**
 * Get all task IDs user can access
 */
export async function listAccessibleTaskIds(
  ctx: Ctx,
  user: ConvexUser
): Promise<Id<"tasks">[]> {
  if (isAdmin(user)) {
    const tasks = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return tasks.map((t) => t._id);
  }

  const projectIds = await listAccessibleProjectIds(ctx, user);

  const allTasks: Doc<"tasks">[] = [];
  for (const projectId of projectIds) {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
    allTasks.push(...tasks);
  }

  return allTasks.map((t) => t._id);
}

// ============================================================
// TASK ASSIGNEE ACCESS
// ============================================================

/**
 * Ensure user can access a task assignee relationship
 */
export async function ensureTaskAssigneeAccess(
  ctx: Ctx,
  user: ConvexUser,
  taskId: Id<"tasks">,
  assigneeId: Id<"users">
): Promise<void> {
  await ensureClientAccessByTaskId(ctx, user, taskId);

  const assignee = await ctx.db
    .query("taskAssignees")
    .withIndex("by_task_user", (q) =>
      q.eq("taskId", taskId).eq("userId", assigneeId)
    )
    .first();

  if (!assignee) {
    throw new NotFoundError("Task assignee not found");
  }
}

// ============================================================
// AUTH HELPERS
// ============================================================

/**
 * Get current user from Convex Auth context
 * Returns null if not authenticated
 */
export async function getCurrentUser(ctx: Ctx): Promise<ConvexUser | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // Look up user by auth ID
  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
    .first();

  return user;
}

/**
 * Require authenticated user, throw if not authenticated
 */
export async function requireUser(ctx: Ctx): Promise<ConvexUser> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new UnauthorizedError("Authentication required");
  }
  return user;
}

/**
 * Require user with specific role
 */
export async function requireRole(
  ctx: Ctx,
  role: "ADMIN" | "CLIENT"
): Promise<ConvexUser> {
  const user = await requireUser(ctx);

  if (role === USER_ROLE.ADMIN && !isAdmin(user)) {
    throw new ForbiddenError("Admin privileges required");
  }

  return user;
}

/**
 * Check if user can modify a resource they created
 */
export function canModifyOwnResource(
  user: ConvexUser,
  creatorId: Id<"users">
): boolean {
  return isAdmin(user) || user._id === creatorId;
}
