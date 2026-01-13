/**
 * Convex error tracking for PostHog
 *
 * Tracks errors from Convex operations to monitor migration health
 * and identify problematic functions.
 */

import { captureServerEvent } from "./server";
import { getCurrentMigrationPhase, getEnabledFlags } from "@/lib/feature-flags";

// ============================================================
// EVENT NAMES
// ============================================================

export const ERROR_EVENTS = {
  CONVEX_ERROR: "convex_error",
  CONVEX_TIMEOUT: "convex_timeout",
} as const;

// ============================================================
// TYPES
// ============================================================

type ConvexSource = "query" | "mutation" | "action";

type ConvexErrorContext = {
  /** The Convex function that threw (e.g., "clients.list") */
  function: string;
  /** Type of Convex operation */
  source: ConvexSource;
  /** Arguments passed to the function (keys only for privacy) */
  args?: Record<string, unknown>;
  /** Additional context */
  metadata?: Record<string, unknown>;
};

// ============================================================
// ERROR TRACKING
// ============================================================

/**
 * Track a Convex function error.
 *
 * @example
 * ```typescript
 * try {
 *   await convex.query(api.clients.list);
 * } catch (error) {
 *   await trackConvexError(error as Error, {
 *     function: "clients.list",
 *     source: "query",
 *   });
 *   throw error;
 * }
 * ```
 */
export async function trackConvexError(
  error: Error,
  context: ConvexErrorContext,
  distinctId?: string
): Promise<void> {
  // Log to console for immediate visibility
  console.error(`[Convex Error] ${context.function}:`, error.message);

  try {
    await captureServerEvent({
      event: ERROR_EVENTS.CONVEX_ERROR,
      distinctId,
      properties: {
        error_message: error.message,
        error_name: error.name,
        error_stack: error.stack?.substring(0, 1000), // Truncate for PostHog
        convex_function: context.function,
        convex_source: context.source,
        args_keys: context.args ? Object.keys(context.args) : [],
        metadata: context.metadata,
        timestamp: Date.now(),
        migrationPhase: getCurrentMigrationPhase(),
        enabledFlags: getEnabledFlags(),
        $set: { has_convex_errors: true },
      },
    });
  } catch {
    console.warn("[Migration] Failed to track Convex error:", {
      function: context.function,
      error: error.message,
    });
  }
}

/**
 * Track a Convex timeout error.
 */
export async function trackConvexTimeout(
  context: ConvexErrorContext,
  timeoutMs: number,
  distinctId?: string
): Promise<void> {
  console.error(`[Convex Timeout] ${context.function} after ${timeoutMs}ms`);

  try {
    await captureServerEvent({
      event: ERROR_EVENTS.CONVEX_TIMEOUT,
      distinctId,
      properties: {
        convex_function: context.function,
        convex_source: context.source,
        timeout_ms: timeoutMs,
        args_keys: context.args ? Object.keys(context.args) : [],
        metadata: context.metadata,
        timestamp: Date.now(),
        migrationPhase: getCurrentMigrationPhase(),
        enabledFlags: getEnabledFlags(),
        $set: { has_convex_errors: true },
      },
    });
  } catch {
    console.warn("[Migration] Failed to track Convex timeout:", {
      function: context.function,
    });
  }
}

// ============================================================
// WRAPPER FUNCTIONS
// ============================================================

/**
 * Wrap a Convex call with automatic error tracking.
 *
 * @example
 * ```typescript
 * const clients = await withErrorTracking(
 *   () => convex.query(api.clients.list, { userId }),
 *   { function: "clients.list", source: "query" }
 * );
 * ```
 */
export async function withErrorTracking<T>(
  fn: () => Promise<T>,
  context: ConvexErrorContext,
  distinctId?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    await trackConvexError(error as Error, context, distinctId);
    throw error;
  }
}

/**
 * Create a tracked Convex query wrapper.
 *
 * @example
 * ```typescript
 * const trackedListClients = createTrackedQuery(
 *   "clients.list",
 *   (args: { userId: string }) => convex.query(api.clients.list, args)
 * );
 *
 * const clients = await trackedListClients({ userId });
 * ```
 */
export function createTrackedQuery<TArgs, TResult>(
  functionName: string,
  queryFn: (args: TArgs) => Promise<TResult>
): (args: TArgs, distinctId?: string) => Promise<TResult> {
  return async (args: TArgs, distinctId?: string) => {
    return withErrorTracking(
      () => queryFn(args),
      {
        function: functionName,
        source: "query",
        args: args as Record<string, unknown>,
      },
      distinctId
    );
  };
}

/**
 * Create a tracked Convex mutation wrapper.
 *
 * @example
 * ```typescript
 * const trackedCreateClient = createTrackedMutation(
 *   "clients.create",
 *   (args: CreateClientArgs) => convex.mutation(api.clients.create, args)
 * );
 *
 * const client = await trackedCreateClient({ name: "Acme Inc" });
 * ```
 */
export function createTrackedMutation<TArgs, TResult>(
  functionName: string,
  mutationFn: (args: TArgs) => Promise<TResult>
): (args: TArgs, distinctId?: string) => Promise<TResult> {
  return async (args: TArgs, distinctId?: string) => {
    return withErrorTracking(
      () => mutationFn(args),
      {
        function: functionName,
        source: "mutation",
        args: args as Record<string, unknown>,
      },
      distinctId
    );
  };
}

/**
 * Create a tracked Convex action wrapper.
 */
export function createTrackedAction<TArgs, TResult>(
  functionName: string,
  actionFn: (args: TArgs) => Promise<TResult>
): (args: TArgs, distinctId?: string) => Promise<TResult> {
  return async (args: TArgs, distinctId?: string) => {
    return withErrorTracking(
      () => actionFn(args),
      {
        function: functionName,
        source: "action",
        args: args as Record<string, unknown>,
      },
      distinctId
    );
  };
}

// ============================================================
// CLIENT-SIDE ERROR TRACKING
// ============================================================

/**
 * Track Convex errors from client-side (React hooks).
 */
export function trackConvexErrorClient(
  error: Error,
  context: ConvexErrorContext
): void {
  if (typeof window === "undefined") return;

  // Log to console
  console.error(`[Convex Error] ${context.function}:`, error.message);

  try {
    import("posthog-js").then((posthog) => {
      posthog.default.capture(ERROR_EVENTS.CONVEX_ERROR, {
        error_message: error.message,
        error_name: error.name,
        convex_function: context.function,
        convex_source: context.source,
        args_keys: context.args ? Object.keys(context.args) : [],
        timestamp: Date.now(),
        $set: { has_convex_errors: true },
      });
    });
  } catch {
    // Silent fail
  }
}
