/**
 * Typed validators for activity log metadata
 *
 * Provides type-safe metadata for different activity event types
 * instead of using v.any() for the metadata field.
 */

import { v } from "convex/values";
import { taskStatusValidator } from "../validators";

// ============================================================
// TASK EVENTS
// ============================================================

export const taskCreatedMetadata = v.object({
  type: v.literal("task.created"),
  taskId: v.string(),
  title: v.string(),
});

export const taskUpdatedMetadata = v.object({
  type: v.literal("task.updated"),
  taskId: v.string(),
  changes: v.array(
    v.object({
      field: v.string(),
      from: v.optional(v.any()),
      to: v.optional(v.any()),
    })
  ),
});

export const taskStatusChangedMetadata = v.object({
  type: v.literal("task.status_changed"),
  taskId: v.string(),
  from: taskStatusValidator,
  to: taskStatusValidator,
});

export const taskAssignedMetadata = v.object({
  type: v.literal("task.assigned"),
  taskId: v.string(),
  assigneeId: v.string(),
});

export const taskUnassignedMetadata = v.object({
  type: v.literal("task.unassigned"),
  taskId: v.string(),
  assigneeId: v.string(),
});

export const taskArchivedMetadata = v.object({
  type: v.literal("task.archived"),
  taskId: v.string(),
});

export const taskRestoredMetadata = v.object({
  type: v.literal("task.restored"),
  taskId: v.string(),
});

export const taskCommentAddedMetadata = v.object({
  type: v.literal("task.comment_added"),
  taskId: v.string(),
  commentId: v.string(),
});

export const taskAttachmentAddedMetadata = v.object({
  type: v.literal("task.attachment_added"),
  taskId: v.string(),
  attachmentId: v.string(),
  fileName: v.string(),
});

// ============================================================
// PROJECT EVENTS
// ============================================================

export const projectCreatedMetadata = v.object({
  type: v.literal("project.created"),
  projectId: v.string(),
  name: v.string(),
});

export const projectUpdatedMetadata = v.object({
  type: v.literal("project.updated"),
  projectId: v.string(),
  changes: v.array(
    v.object({
      field: v.string(),
      from: v.optional(v.any()),
      to: v.optional(v.any()),
    })
  ),
});

export const projectArchivedMetadata = v.object({
  type: v.literal("project.archived"),
  projectId: v.string(),
});

export const projectRestoredMetadata = v.object({
  type: v.literal("project.restored"),
  projectId: v.string(),
});

// ============================================================
// CLIENT EVENTS
// ============================================================

export const clientCreatedMetadata = v.object({
  type: v.literal("client.created"),
  clientId: v.string(),
  name: v.string(),
});

export const clientUpdatedMetadata = v.object({
  type: v.literal("client.updated"),
  clientId: v.string(),
  changes: v.array(
    v.object({
      field: v.string(),
      from: v.optional(v.any()),
      to: v.optional(v.any()),
    })
  ),
});

export const clientArchivedMetadata = v.object({
  type: v.literal("client.archived"),
  clientId: v.string(),
});

export const clientMemberAddedMetadata = v.object({
  type: v.literal("client.member_added"),
  clientId: v.string(),
  userId: v.string(),
});

export const clientMemberRemovedMetadata = v.object({
  type: v.literal("client.member_removed"),
  clientId: v.string(),
  userId: v.string(),
});

// ============================================================
// TIME LOG EVENTS
// ============================================================

export const timeLogCreatedMetadata = v.object({
  type: v.literal("timelog.created"),
  timeLogId: v.string(),
  hours: v.number(),
  projectId: v.string(),
});

export const timeLogUpdatedMetadata = v.object({
  type: v.literal("timelog.updated"),
  timeLogId: v.string(),
  changes: v.array(
    v.object({
      field: v.string(),
      from: v.optional(v.any()),
      to: v.optional(v.any()),
    })
  ),
});

export const timeLogDeletedMetadata = v.object({
  type: v.literal("timelog.deleted"),
  timeLogId: v.string(),
});

// ============================================================
// USER EVENTS
// ============================================================

export const userCreatedMetadata = v.object({
  type: v.literal("user.created"),
  userId: v.string(),
  email: v.string(),
});

export const userUpdatedMetadata = v.object({
  type: v.literal("user.updated"),
  userId: v.string(),
  changes: v.array(
    v.object({
      field: v.string(),
      from: v.optional(v.any()),
      to: v.optional(v.any()),
    })
  ),
});

export const userRoleChangedMetadata = v.object({
  type: v.literal("user.role_changed"),
  userId: v.string(),
  from: v.string(),
  to: v.string(),
});

// ============================================================
// HOUR BLOCK EVENTS
// ============================================================

export const hourBlockCreatedMetadata = v.object({
  type: v.literal("hourblock.created"),
  hourBlockId: v.string(),
  clientId: v.string(),
  totalHours: v.number(),
});

export const hourBlockUpdatedMetadata = v.object({
  type: v.literal("hourblock.updated"),
  hourBlockId: v.string(),
  changes: v.array(
    v.object({
      field: v.string(),
      from: v.optional(v.any()),
      to: v.optional(v.any()),
    })
  ),
});

// ============================================================
// LEAD EVENTS
// ============================================================

export const leadCreatedMetadata = v.object({
  type: v.literal("lead.created"),
  leadId: v.string(),
  name: v.string(),
});

export const leadUpdatedMetadata = v.object({
  type: v.literal("lead.updated"),
  leadId: v.string(),
  changes: v.array(
    v.object({
      field: v.string(),
      from: v.optional(v.any()),
      to: v.optional(v.any()),
    })
  ),
});

export const leadStatusChangedMetadata = v.object({
  type: v.literal("lead.status_changed"),
  leadId: v.string(),
  from: v.string(),
  to: v.string(),
});

// ============================================================
// COMBINED VALIDATOR
// ============================================================

/**
 * Combined validator for all activity metadata types.
 * Use this for the activityLogs.metadata field if you want strict typing.
 */
export const activityMetadataValidator = v.union(
  // Task events
  taskCreatedMetadata,
  taskUpdatedMetadata,
  taskStatusChangedMetadata,
  taskAssignedMetadata,
  taskUnassignedMetadata,
  taskArchivedMetadata,
  taskRestoredMetadata,
  taskCommentAddedMetadata,
  taskAttachmentAddedMetadata,
  // Project events
  projectCreatedMetadata,
  projectUpdatedMetadata,
  projectArchivedMetadata,
  projectRestoredMetadata,
  // Client events
  clientCreatedMetadata,
  clientUpdatedMetadata,
  clientArchivedMetadata,
  clientMemberAddedMetadata,
  clientMemberRemovedMetadata,
  // Time log events
  timeLogCreatedMetadata,
  timeLogUpdatedMetadata,
  timeLogDeletedMetadata,
  // User events
  userCreatedMetadata,
  userUpdatedMetadata,
  userRoleChangedMetadata,
  // Hour block events
  hourBlockCreatedMetadata,
  hourBlockUpdatedMetadata,
  // Lead events
  leadCreatedMetadata,
  leadUpdatedMetadata,
  leadStatusChangedMetadata
);

// ============================================================
// TYPE EXPORTS
// ============================================================

export type TaskCreatedMetadata = {
  type: "task.created";
  taskId: string;
  title: string;
};

export type TaskUpdatedMetadata = {
  type: "task.updated";
  taskId: string;
  changes: Array<{ field: string; from?: unknown; to?: unknown }>;
};

export type TaskStatusChangedMetadata = {
  type: "task.status_changed";
  taskId: string;
  from: string;
  to: string;
};

export type ActivityMetadata =
  | TaskCreatedMetadata
  | TaskUpdatedMetadata
  | TaskStatusChangedMetadata;
// Add more as needed
