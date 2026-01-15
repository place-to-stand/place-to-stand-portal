/**
 * Date validation utilities for Convex
 *
 * Provides validators and helpers for ISO date strings used in the schema.
 * Convex stores dates as strings (ISO format) or numbers (timestamps).
 */

import { v, Validator } from "convex/values";

// ============================================================
// VALIDATORS
// ============================================================

/**
 * ISO date string validator (YYYY-MM-DD)
 *
 * @example
 * ```typescript
 * defineTable({
 *   startDate: isoDateValidator,
 * })
 * ```
 */
export const isoDateValidator = v.string();

/**
 * Optional ISO date string validator
 */
export const optionalIsoDateValidator = v.optional(v.string());

/**
 * Unix timestamp validator (milliseconds since epoch)
 */
export const timestampValidator = v.number();

/**
 * Optional timestamp validator
 */
export const optionalTimestampValidator = v.optional(v.number());

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

/**
 * ISO date regex pattern (YYYY-MM-DD)
 */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate that a string is a valid ISO date (YYYY-MM-DD)
 *
 * @example
 * ```typescript
 * if (!isValidIsoDate(args.date)) {
 *   throw new ConvexError("Invalid date format. Expected YYYY-MM-DD");
 * }
 * ```
 */
export function isValidIsoDate(date: string): boolean {
  if (!ISO_DATE_REGEX.test(date)) {
    return false;
  }

  // Verify it's an actual valid date
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

/**
 * Assert that a string is a valid ISO date
 *
 * @throws Error if date is invalid
 */
export function assertValidIsoDate(
  date: string,
  fieldName: string = "date"
): void {
  if (!isValidIsoDate(date)) {
    throw new Error(
      `Invalid ${fieldName} format. Expected YYYY-MM-DD, got: ${date}`
    );
  }
}

// ============================================================
// CONVERSION HELPERS
// ============================================================

/**
 * Convert ISO date string to Unix timestamp (start of day, UTC)
 *
 * @example
 * ```typescript
 * const timestamp = isoDateToTimestamp("2024-01-15");
 * // Returns timestamp for 2024-01-15T00:00:00.000Z
 * ```
 */
export function isoDateToTimestamp(isoDate: string): number {
  assertValidIsoDate(isoDate);
  return new Date(isoDate + "T00:00:00.000Z").getTime();
}

/**
 * Convert Unix timestamp to ISO date string (YYYY-MM-DD)
 *
 * @example
 * ```typescript
 * const date = timestampToIsoDate(Date.now());
 * // Returns "2024-01-15"
 * ```
 */
export function timestampToIsoDate(timestamp: number): string {
  return new Date(timestamp).toISOString().split("T")[0];
}

/**
 * Get current date as ISO string (YYYY-MM-DD)
 */
export function todayIsoDate(): string {
  return timestampToIsoDate(Date.now());
}

// ============================================================
// DATE RANGE HELPERS
// ============================================================

/**
 * Check if a date is within a range (inclusive)
 *
 * @example
 * ```typescript
 * if (!isDateInRange(log.date, args.startDate, args.endDate)) {
 *   // Skip this log
 * }
 * ```
 */
export function isDateInRange(
  date: string,
  startDate: string,
  endDate: string
): boolean {
  return date >= startDate && date <= endDate;
}

/**
 * Get date range for common periods
 */
export function getDateRange(period: "week" | "month" | "quarter" | "year"): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const endDate = timestampToIsoDate(now.getTime());

  let startDate: string;

  switch (period) {
    case "week":
      startDate = timestampToIsoDate(
        now.getTime() - 7 * 24 * 60 * 60 * 1000
      );
      break;
    case "month":
      startDate = timestampToIsoDate(
        now.getTime() - 30 * 24 * 60 * 60 * 1000
      );
      break;
    case "quarter":
      startDate = timestampToIsoDate(
        now.getTime() - 90 * 24 * 60 * 60 * 1000
      );
      break;
    case "year":
      startDate = timestampToIsoDate(
        now.getTime() - 365 * 24 * 60 * 60 * 1000
      );
      break;
  }

  return { startDate, endDate };
}
