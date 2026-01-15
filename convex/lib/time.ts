/**
 * Time and timestamp utilities for Convex
 *
 * All timestamps in Convex are stored as Unix milliseconds (number).
 * These utilities provide consistent conversion and formatting.
 */

// ============================================================
// TIMESTAMP CONVERSION
// ============================================================

/**
 * Get current timestamp (Unix ms)
 */
export function now(): number {
  return Date.now();
}

/**
 * Convert Date to Unix timestamp (ms)
 */
export function toTimestamp(date: Date): number {
  return date.getTime();
}

/**
 * Convert Unix timestamp (ms) to Date
 */
export function fromTimestamp(timestamp: number): Date {
  return new Date(timestamp);
}

/**
 * Convert ISO string to Unix timestamp (ms)
 */
export function isoToTimestamp(isoString: string): number {
  return new Date(isoString).getTime();
}

/**
 * Convert Unix timestamp (ms) to ISO string
 */
export function timestampToIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

// ============================================================
// DATE STRINGS (YYYY-MM-DD)
// ============================================================

/**
 * Get current date as ISO date string (YYYY-MM-DD)
 */
export function today(): string {
  return toDateString(new Date());
}

/**
 * Convert Date to ISO date string (YYYY-MM-DD)
 */
export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Convert ISO date string (YYYY-MM-DD) to Date at midnight UTC
 */
export function fromDateString(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Convert Unix timestamp to ISO date string (YYYY-MM-DD)
 */
export function timestampToDateString(timestamp: number): string {
  return toDateString(new Date(timestamp));
}

/**
 * Validate ISO date string format (YYYY-MM-DD)
 * Checks both format and validity (e.g., rejects 2024-02-30)
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

// ============================================================
// TIMESTAMP FIELDS
// ============================================================

/**
 * Get timestamp fields for document creation
 *
 * @example
 * ```typescript
 * await ctx.db.insert("tasks", {
 *   title: "New task",
 *   ...createTimestamps(),
 * });
 * ```
 */
export function createTimestamps(): { createdAt: number; updatedAt: number } {
  const timestamp = now();
  return {
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Get timestamp field for document update
 *
 * @example
 * ```typescript
 * await ctx.db.patch(taskId, {
 *   title: "Updated title",
 *   ...updateTimestamp(),
 * });
 * ```
 */
export function updateTimestamp(): { updatedAt: number } {
  return {
    updatedAt: now(),
  };
}

// ============================================================
// TIME CALCULATIONS
// ============================================================

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = MS_PER_SECOND * 60;
const MS_PER_HOUR = MS_PER_MINUTE * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;
const MS_PER_WEEK = MS_PER_DAY * 7;

/**
 * Get timestamp N days ago
 */
export function daysAgo(days: number): number {
  return now() - days * MS_PER_DAY;
}

/**
 * Get timestamp N days from now
 */
export function daysFromNow(days: number): number {
  return now() + days * MS_PER_DAY;
}

/**
 * Get timestamp N hours ago
 */
export function hoursAgo(hours: number): number {
  return now() - hours * MS_PER_HOUR;
}

/**
 * Get timestamp N hours from now
 */
export function hoursFromNow(hours: number): number {
  return now() + hours * MS_PER_HOUR;
}

/**
 * Get timestamp N weeks ago
 */
export function weeksAgo(weeks: number): number {
  return now() - weeks * MS_PER_WEEK;
}

/**
 * Get start of day (midnight UTC) for a timestamp
 */
export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Get end of day (23:59:59.999 UTC) for a timestamp
 */
export function endOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(23, 59, 59, 999);
  return date.getTime();
}

// ============================================================
// TIME WINDOW HELPERS (for activity cache)
// ============================================================

/**
 * Get timestamp range for a time window
 */
export function getTimeWindowRange(windowDays: number): {
  start: number;
  end: number;
} {
  const end = now();
  const start = daysAgo(windowDays);
  return { start, end };
}

/**
 * Check if a timestamp is within a time window
 */
export function isWithinWindow(
  timestamp: number,
  windowDays: number
): boolean {
  const { start, end } = getTimeWindowRange(windowDays);
  return timestamp >= start && timestamp <= end;
}

/**
 * Get cache expiration timestamp
 * Activity caches typically expire after a shorter period than the window
 */
export function getCacheExpiration(
  windowDays: number,
  cacheDurationHours: number = 1
): number {
  return hoursFromNow(cacheDurationHours);
}
