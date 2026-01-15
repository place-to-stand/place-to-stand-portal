/**
 * Feature flags for Convex migration
 *
 * Controls which database (Supabase vs Convex) is used for each domain.
 * Flags are read from environment variables at runtime.
 *
 * IMPORTANT: Flags have strict dependencies. You cannot enable a flag
 * without first enabling its dependencies. This is enforced at startup.
 */

// ============================================================
// FLAG DEFINITIONS
// ============================================================

/**
 * Convex migration feature flags
 *
 * Each flag controls whether a specific domain reads/writes to Convex
 * instead of Supabase. All flags default to false (use Supabase).
 */
export const CONVEX_FLAGS = {
  /** Use Convex Auth (Google OAuth) instead of Supabase Auth */
  AUTH: process.env.NEXT_PUBLIC_USE_CONVEX_AUTH === "true",

  /** Use Convex Storage instead of Supabase Storage */
  STORAGE: process.env.NEXT_PUBLIC_USE_CONVEX_STORAGE === "true",

  /** Use Convex for clients and client_members tables */
  CLIENTS: process.env.NEXT_PUBLIC_USE_CONVEX_CLIENTS === "true",

  /** Use Convex for projects table */
  PROJECTS: process.env.NEXT_PUBLIC_USE_CONVEX_PROJECTS === "true",

  /** Use Convex for tasks and related tables */
  TASKS: process.env.NEXT_PUBLIC_USE_CONVEX_TASKS === "true",

  /** Use Convex for time_logs and time_log_tasks tables */
  TIME_LOGS: process.env.NEXT_PUBLIC_USE_CONVEX_TIME_LOGS === "true",

  /** Use Convex for activity_logs and activity_cache tables */
  ACTIVITY: process.env.NEXT_PUBLIC_USE_CONVEX_ACTIVITY === "true",

  /** Use Convex for hour_blocks table */
  HOUR_BLOCKS: process.env.NEXT_PUBLIC_USE_CONVEX_HOUR_BLOCKS === "true",

  /** Use Convex for leads and contacts tables */
  LEADS: process.env.NEXT_PUBLIC_USE_CONVEX_LEADS === "true",

  /** Use Convex for threads, messages, suggestions tables */
  MESSAGING: process.env.NEXT_PUBLIC_USE_CONVEX_MESSAGING === "true",
} as const;

export type ConvexFlagKey = keyof typeof CONVEX_FLAGS;

// ============================================================
// FLAG DEPENDENCIES
// ============================================================

/**
 * Dependency graph for feature flags.
 *
 * A flag can only be enabled if all its dependencies are also enabled.
 * This prevents inconsistent states where, e.g., tasks use Convex but
 * projects still use Supabase.
 */
const FLAG_DEPENDENCIES: Record<ConvexFlagKey, ConvexFlagKey[]> = {
  AUTH: [],
  STORAGE: ["AUTH"],
  CLIENTS: ["AUTH"],
  PROJECTS: ["AUTH", "CLIENTS"],
  TASKS: ["AUTH", "PROJECTS"],
  TIME_LOGS: ["AUTH", "PROJECTS", "TASKS"],
  ACTIVITY: ["AUTH"],
  HOUR_BLOCKS: ["AUTH", "CLIENTS"],
  LEADS: ["AUTH"],
  MESSAGING: ["AUTH"],
};

/**
 * Recommended order for enabling flags during migration.
 * Each phase should be validated before moving to the next.
 */
export const RECOMMENDED_ENABLE_ORDER: ConvexFlagKey[] = [
  "AUTH", // Phase 2
  "STORAGE", // Phase 2
  "CLIENTS", // Phase 3A
  "PROJECTS", // Phase 3B
  "TASKS", // Phase 3C
  "TIME_LOGS", // Phase 3D
  "ACTIVITY", // Phase 4A
  "HOUR_BLOCKS", // Phase 4B
  "LEADS", // Phase 4C
  "MESSAGING", // Phase 4E
];

// ============================================================
// VALIDATION
// ============================================================

/**
 * Validate that all enabled flags have their dependencies met.
 *
 * @throws Error if any flag is enabled without its dependencies
 *
 * @example
 * ```typescript
 * // Call at app startup
 * validateFeatureFlags();
 * ```
 */
export function validateFeatureFlags(): void {
  const errors: string[] = [];

  for (const [flag, deps] of Object.entries(FLAG_DEPENDENCIES)) {
    const flagKey = flag as ConvexFlagKey;

    if (CONVEX_FLAGS[flagKey]) {
      for (const dep of deps) {
        if (!CONVEX_FLAGS[dep]) {
          errors.push(`${flag} requires ${dep} to be enabled`);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Feature flag dependency errors:\n${errors.map((e) => `  - ${e}`).join("\n")}`
    );
  }
}

/**
 * Get the current migration phase based on enabled flags.
 * Useful for dashboard displays and migration tracking.
 */
export function getCurrentMigrationPhase(): string {
  if (!CONVEX_FLAGS.AUTH) {
    return "phase-1-setup";
  }

  if (!CONVEX_FLAGS.CLIENTS) {
    return "phase-2-auth";
  }

  if (!CONVEX_FLAGS.PROJECTS) {
    return "phase-3a-clients";
  }

  if (!CONVEX_FLAGS.TASKS) {
    return "phase-3b-projects";
  }

  if (!CONVEX_FLAGS.TIME_LOGS) {
    return "phase-3c-tasks";
  }

  if (!CONVEX_FLAGS.ACTIVITY) {
    return "phase-3d-time-logs";
  }

  if (!CONVEX_FLAGS.HOUR_BLOCKS || !CONVEX_FLAGS.LEADS || !CONVEX_FLAGS.MESSAGING) {
    return "phase-4-remaining";
  }

  return "phase-5-cleanup";
}

/**
 * Check if all Convex flags are enabled (migration complete)
 */
export function isMigrationComplete(): boolean {
  return Object.values(CONVEX_FLAGS).every((enabled) => enabled);
}

/**
 * Check if any Convex flag is enabled (migration in progress)
 */
export function isMigrationInProgress(): boolean {
  return Object.values(CONVEX_FLAGS).some((enabled) => enabled);
}

/**
 * Get list of currently enabled flags
 */
export function getEnabledFlags(): ConvexFlagKey[] {
  return Object.entries(CONVEX_FLAGS)
    .filter(([, enabled]) => enabled)
    .map(([flag]) => flag as ConvexFlagKey);
}

/**
 * Get list of currently disabled flags
 */
export function getDisabledFlags(): ConvexFlagKey[] {
  return Object.entries(CONVEX_FLAGS)
    .filter(([, enabled]) => !enabled)
    .map(([flag]) => flag as ConvexFlagKey);
}

// ============================================================
// HELPER HOOKS
// ============================================================

/**
 * Type-safe flag check
 *
 * @example
 * ```typescript
 * if (isConvexEnabled("CLIENTS")) {
 *   // Use Convex client adapter
 * } else {
 *   // Use Supabase client adapter
 * }
 * ```
 */
export function isConvexEnabled(flag: ConvexFlagKey): boolean {
  return CONVEX_FLAGS[flag];
}

/**
 * Get the data source for a domain
 *
 * @example
 * ```typescript
 * const source = getDataSource("CLIENTS"); // "convex" or "supabase"
 * ```
 */
export function getDataSource(flag: ConvexFlagKey): "convex" | "supabase" {
  return CONVEX_FLAGS[flag] ? "convex" : "supabase";
}
