/**
 * Soft delete utilities for Convex
 *
 * Convex doesn't have built-in soft delete support, so we implement it
 * using a `deletedAt` timestamp field on documents.
 *
 * NOTE: Filter helpers like notDeleted() and onlyDeleted() use inline
 * filter expressions in queries. See examples below for usage.
 */

import { now } from "./time";

// ============================================================
// TYPE HELPERS
// ============================================================

/**
 * Document type with soft delete fields
 */
export type SoftDeletable = {
  deletedAt?: number;
  updatedAt: number;
};

// ============================================================
// DOCUMENT HELPERS
// ============================================================

/**
 * Check if a document is soft-deleted
 */
export function isDeleted(doc: SoftDeletable | null | undefined): boolean {
  return doc?.deletedAt !== undefined;
}

/**
 * Check if a document is active (not soft-deleted)
 */
export function isActive(doc: SoftDeletable | null | undefined): boolean {
  return doc !== null && doc !== undefined && doc.deletedAt === undefined;
}

/**
 * Get soft delete patch fields for archiving a document
 *
 * @example
 * ```typescript
 * await ctx.db.patch(taskId, softDeleteFields());
 * ```
 */
export function softDeleteFields(): { deletedAt: number; updatedAt: number } {
  const timestamp = now();
  return {
    deletedAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Get restore patch fields for un-archiving a document
 *
 * @example
 * ```typescript
 * await ctx.db.patch(taskId, restoreFields());
 * ```
 */
export function restoreFields(): { deletedAt: undefined; updatedAt: number } {
  return {
    deletedAt: undefined,
    updatedAt: now(),
  };
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Assert document exists and is not soft-deleted
 *
 * @throws Error if document is null or soft-deleted
 */
export function assertActiveDocument<T extends SoftDeletable>(
  doc: T | null,
  entityName: string
): asserts doc is T {
  if (!doc || isDeleted(doc)) {
    throw new Error(`${entityName} not found`);
  }
}

/**
 * Assert document exists (including soft-deleted)
 *
 * @throws Error if document is null
 */
export function assertDocumentExists<T>(
  doc: T | null,
  entityName: string
): asserts doc is T {
  if (!doc) {
    throw new Error(`${entityName} not found`);
  }
}

// ============================================================
// QUERY FILTER PATTERNS
// ============================================================

/**
 * Common filter patterns for soft delete queries.
 *
 * Use these inline in your queries:
 *
 * @example Filter out deleted documents
 * ```typescript
 * const activeTasks = await ctx.db
 *   .query("tasks")
 *   .filter((q) => q.eq(q.field("deletedAt"), undefined))
 *   .collect();
 * ```
 *
 * @example Get only deleted documents
 * ```typescript
 * const archivedTasks = await ctx.db
 *   .query("tasks")
 *   .filter((q) => q.neq(q.field("deletedAt"), undefined))
 *   .collect();
 * ```
 *
 * @example Combine with other filters
 * ```typescript
 * const activeProjectTasks = await ctx.db
 *   .query("tasks")
 *   .withIndex("by_project", (q) => q.eq("projectId", projectId))
 *   .filter((q) =>
 *     q.and(
 *       q.eq(q.field("deletedAt"), undefined),
 *       q.eq(q.field("status"), "IN_PROGRESS")
 *     )
 *   )
 *   .collect();
 * ```
 */
export const SOFT_DELETE_PATTERNS = {
  /**
   * Filter expression to exclude soft-deleted documents
   * `(q) => q.eq(q.field("deletedAt"), undefined)`
   */
  NOT_DELETED: '(q) => q.eq(q.field("deletedAt"), undefined)',

  /**
   * Filter expression to include only soft-deleted documents
   * `(q) => q.neq(q.field("deletedAt"), undefined)`
   */
  ONLY_DELETED: '(q) => q.neq(q.field("deletedAt"), undefined)',
} as const;
