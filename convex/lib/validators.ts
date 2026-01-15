/**
 * Shared validators for Convex functions
 *
 * Re-exports schema validators and provides additional validation utilities.
 */

import { v } from "convex/values";

// Re-export all validators from schema for convenience
export {
  taskStatusValidator,
  userRoleValidator,
  clientBillingTypeValidator,
  projectTypeValidator,
  projectStatusValidator,
  leadStatusValidator,
  leadSourceTypeValidator,
  oauthProviderValidator,
  oauthConnectionStatusValidator,
  messageSourceValidator,
  threadStatusValidator,
  suggestionTypeValidator,
  suggestionStatusValidator,
  migrationRunStatusValidator,
} from "../schema";

// ============================================================
// TYPE VALUES (for type-safe comparisons)
// ============================================================

export const TASK_STATUS = {
  BACKLOG: "BACKLOG",
  ON_DECK: "ON_DECK",
  IN_PROGRESS: "IN_PROGRESS",
  IN_REVIEW: "IN_REVIEW",
  BLOCKED: "BLOCKED",
  DONE: "DONE",
  ARCHIVED: "ARCHIVED",
} as const;

export const USER_ROLE = {
  ADMIN: "ADMIN",
  CLIENT: "CLIENT",
} as const;

export const CLIENT_BILLING_TYPE = {
  PREPAID: "prepaid",
  NET_30: "net_30",
} as const;

export const PROJECT_TYPE = {
  CLIENT: "CLIENT",
  PERSONAL: "PERSONAL",
  INTERNAL: "INTERNAL",
} as const;

export const PROJECT_STATUS = {
  ONBOARDING: "ONBOARDING",
  ACTIVE: "ACTIVE",
  ON_HOLD: "ON_HOLD",
  COMPLETED: "COMPLETED",
} as const;

export const LEAD_STATUS = {
  NEW_OPPORTUNITIES: "NEW_OPPORTUNITIES",
  ACTIVE_OPPORTUNITIES: "ACTIVE_OPPORTUNITIES",
  PROPOSAL_SENT: "PROPOSAL_SENT",
  ON_ICE: "ON_ICE",
  CLOSED_WON: "CLOSED_WON",
  CLOSED_LOST: "CLOSED_LOST",
  UNQUALIFIED: "UNQUALIFIED",
} as const;

export const LEAD_SOURCE_TYPE = {
  REFERRAL: "REFERRAL",
  WEBSITE: "WEBSITE",
  EVENT: "EVENT",
} as const;

export const OAUTH_PROVIDER = {
  GOOGLE: "GOOGLE",
  GITHUB: "GITHUB",
} as const;

export const OAUTH_CONNECTION_STATUS = {
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
  PENDING_REAUTH: "PENDING_REAUTH",
} as const;

export const MESSAGE_SOURCE = {
  EMAIL: "EMAIL",
  CHAT: "CHAT",
  VOICE_MEMO: "VOICE_MEMO",
  DOCUMENT: "DOCUMENT",
  FORM: "FORM",
} as const;

export const THREAD_STATUS = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
  ARCHIVED: "ARCHIVED",
} as const;

export const SUGGESTION_TYPE = {
  TASK: "TASK",
  PR: "PR",
  REPLY: "REPLY",
} as const;

export const SUGGESTION_STATUS = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  MODIFIED: "MODIFIED",
  FAILED: "FAILED",
} as const;

// ============================================================
// DATE VALIDATORS
// ============================================================

/**
 * Validates ISO date string format (YYYY-MM-DD)
 */
export function isValidIsoDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * ISO date string validator for use in Convex functions
 */
export const isoDateValidator = v.string();

// ============================================================
// PAGINATION VALIDATORS
// ============================================================

export const paginationOptsValidator = v.object({
  numItems: v.number(),
  cursor: v.optional(v.string()),
});

// ============================================================
// COMMON FIELD VALIDATORS
// ============================================================

/**
 * Timestamps validator for document fields
 */
export const timestampsValidator = {
  createdAt: v.number(),
  updatedAt: v.number(),
};

/**
 * Soft delete field validator
 */
export const softDeleteValidator = {
  deletedAt: v.optional(v.number()),
};

/**
 * Migration tracking field validator
 */
export const migrationTrackingValidator = {
  _supabaseId: v.optional(v.string()),
};
