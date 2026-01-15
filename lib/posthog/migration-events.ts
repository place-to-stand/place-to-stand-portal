/**
 * Migration observability events for PostHog
 *
 * Tracks data source usage, dual-read mismatches, and migration progress
 * during the Supabase to Convex migration.
 */

import { captureServerEvent } from "./server";
import {
  type ConvexFlagKey,
  getCurrentMigrationPhase,
  getEnabledFlags,
} from "@/lib/feature-flags";

// ============================================================
// EVENT NAMES
// ============================================================

export const MIGRATION_EVENTS = {
  DATA_SOURCE_HIT: "migration_data_source_hit",
  DUAL_READ_MISMATCH: "migration_dual_read_mismatch",
  PHASE_UPDATE: "migration_phase_update",
  FLAG_CHANGED: "migration_flag_changed",
} as const;

// ============================================================
// TYPES
// ============================================================

type DataSource = "supabase" | "convex";
type Operation = "read" | "write";
type MismatchType = "count" | "data" | "missing";
type PhaseStatus = "started" | "completed" | "failed";

type DualReadMismatchDetails = {
  supabaseCount?: number;
  convexCount?: number;
  missingIds?: string[];
  extraIds?: string[];
  diffFields?: string[];
  [key: string]: unknown;
};

type PhaseUpdateDetails = {
  recordsProcessed?: number;
  recordsSkipped?: number;
  duration?: number;
  error?: string;
  [key: string]: unknown;
};

// ============================================================
// DATA SOURCE TRACKING
// ============================================================

/**
 * Track which database is being used for a read/write operation.
 *
 * Call this in every data fetching/mutation function to track
 * migration progress and identify when Convex is being used.
 *
 * @example
 * ```typescript
 * async function fetchClients(userId: string) {
 *   const source = CONVEX_FLAGS.CLIENTS ? "convex" : "supabase";
 *   trackDataSourceHit(source, "clients", "read", userId);
 *
 *   return adapter.list(userId);
 * }
 * ```
 */
export async function trackDataSourceHit(
  source: DataSource,
  domain: string,
  operation: Operation,
  distinctId?: string
): Promise<void> {
  try {
    await captureServerEvent({
      event: MIGRATION_EVENTS.DATA_SOURCE_HIT,
      distinctId,
      properties: {
        source,
        domain,
        operation,
        timestamp: Date.now(),
        migrationPhase: getCurrentMigrationPhase(),
        enabledFlags: getEnabledFlags(),
      },
    });
  } catch {
    // Silent fail - don't block data operations for tracking
    console.warn("[Migration] Failed to track data source hit:", {
      source,
      domain,
      operation,
    });
  }
}

/**
 * Client-side version for tracking in React components
 */
export function trackDataSourceHitClient(
  source: DataSource,
  domain: string,
  operation: Operation
): void {
  if (typeof window === "undefined") return;

  try {
    // Use dynamic import to avoid issues with server-side rendering
    import("posthog-js").then((posthog) => {
      posthog.default.capture(MIGRATION_EVENTS.DATA_SOURCE_HIT, {
        source,
        domain,
        operation,
        timestamp: Date.now(),
        migrationPhase: getCurrentMigrationPhase(),
        enabledFlags: getEnabledFlags(),
      });
    });
  } catch {
    // Silent fail
  }
}

// ============================================================
// DUAL-READ MISMATCH TRACKING
// ============================================================

/**
 * Track when Supabase and Convex return different data.
 *
 * Use during validation to identify data consistency issues
 * that need investigation before proceeding with migration.
 *
 * @example
 * ```typescript
 * const [supabaseClients, convexClients] = await Promise.all([
 *   supabaseAdapter.list(userId),
 *   convexAdapter.list(userId),
 * ]);
 *
 * if (supabaseClients.length !== convexClients.length) {
 *   await trackDualReadMismatch("clients", "count", {
 *     supabaseCount: supabaseClients.length,
 *     convexCount: convexClients.length,
 *   });
 * }
 * ```
 */
export async function trackDualReadMismatch(
  domain: string,
  mismatchType: MismatchType,
  details: DualReadMismatchDetails,
  distinctId?: string
): Promise<void> {
  // Also log to console for immediate visibility
  console.error(`[MIGRATION MISMATCH] ${domain}:`, { mismatchType, details });

  try {
    await captureServerEvent({
      event: MIGRATION_EVENTS.DUAL_READ_MISMATCH,
      distinctId,
      properties: {
        domain,
        mismatchType,
        details,
        timestamp: Date.now(),
        migrationPhase: getCurrentMigrationPhase(),
        $set: { has_migration_issues: true },
      },
    });
  } catch {
    console.warn("[Migration] Failed to track dual-read mismatch:", {
      domain,
      mismatchType,
    });
  }
}

// ============================================================
// PHASE PROGRESS TRACKING
// ============================================================

/**
 * Track migration phase progress.
 *
 * Call at the start, completion, or failure of each migration phase.
 *
 * @example
 * ```typescript
 * await trackMigrationPhase("phase-3a-clients", "started");
 *
 * try {
 *   await migrateClients();
 *   await trackMigrationPhase("phase-3a-clients", "completed", {
 *     recordsProcessed: 150,
 *     duration: Date.now() - startTime,
 *   });
 * } catch (error) {
 *   await trackMigrationPhase("phase-3a-clients", "failed", {
 *     error: error.message,
 *   });
 *   throw error;
 * }
 * ```
 */
export async function trackMigrationPhase(
  phase: string,
  status: PhaseStatus,
  details?: PhaseUpdateDetails,
  distinctId?: string
): Promise<void> {
  console.log(`[Migration] ${phase} - ${status}`, details ?? {});

  try {
    await captureServerEvent({
      event: MIGRATION_EVENTS.PHASE_UPDATE,
      distinctId: distinctId ?? "migration-system",
      properties: {
        phase,
        status,
        details,
        timestamp: Date.now(),
        enabledFlags: getEnabledFlags(),
      },
    });
  } catch {
    console.warn("[Migration] Failed to track phase update:", { phase, status });
  }
}

// ============================================================
// FEATURE FLAG TRACKING
// ============================================================

/**
 * Track feature flag changes.
 *
 * Call when enabling/disabling migration flags (typically via deployment).
 *
 * @example
 * ```typescript
 * // In deployment script or admin action
 * await trackFeatureFlagChange("CLIENTS", true, "production");
 * ```
 */
export async function trackFeatureFlagChange(
  flag: ConvexFlagKey,
  enabled: boolean,
  environment: string,
  distinctId?: string
): Promise<void> {
  console.log(`[Migration] Flag ${flag} changed to ${enabled} in ${environment}`);

  try {
    await captureServerEvent({
      event: MIGRATION_EVENTS.FLAG_CHANGED,
      distinctId: distinctId ?? "migration-system",
      properties: {
        flag,
        enabled,
        environment,
        timestamp: Date.now(),
        allEnabledFlags: getEnabledFlags(),
      },
    });
  } catch {
    console.warn("[Migration] Failed to track flag change:", { flag, enabled });
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create a tracked data fetcher that automatically logs data source usage.
 *
 * @example
 * ```typescript
 * const fetchClientsTracked = createTrackedFetcher(
 *   "clients",
 *   () => CONVEX_FLAGS.CLIENTS,
 *   async (source) => {
 *     return source === "convex"
 *       ? convexAdapter.list()
 *       : supabaseAdapter.list();
 *   }
 * );
 *
 * const clients = await fetchClientsTracked(userId);
 * ```
 */
export function createTrackedFetcher<T>(
  domain: string,
  getSource: () => boolean,
  fetcher: (source: DataSource) => Promise<T>
): (distinctId?: string) => Promise<T> {
  return async (distinctId?: string) => {
    const source = getSource() ? "convex" : "supabase";

    // Fire tracking async (don't await)
    trackDataSourceHit(source, domain, "read", distinctId).catch(() => {});

    return fetcher(source);
  };
}

/**
 * Create a tracked mutation that automatically logs data source usage.
 */
export function createTrackedMutation<TArgs, TResult>(
  domain: string,
  getSource: () => boolean,
  mutation: (source: DataSource, args: TArgs) => Promise<TResult>
): (args: TArgs, distinctId?: string) => Promise<TResult> {
  return async (args: TArgs, distinctId?: string) => {
    const source = getSource() ? "convex" : "supabase";

    // Fire tracking async (don't await)
    trackDataSourceHit(source, domain, "write", distinctId).catch(() => {});

    return mutation(source, args);
  };
}
