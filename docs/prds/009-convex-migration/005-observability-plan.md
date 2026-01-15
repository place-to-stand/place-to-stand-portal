# Observability Plan

**Status:** Phase 1 Setup - Configure before Phase 2

This document details the observability strategy for the Supabase to Convex migration, using PostHog for event tracking and dashboards.

---

## PostHog Events

### Migration Data Source Events

Track which database is being used for each operation.

```typescript
// lib/posthog/migration-events.ts
import { posthog } from "./client";

/**
 * Track data source hit - call on every read/write operation
 */
export function trackDataSourceHit(
  source: "supabase" | "convex",
  domain: string,
  operation: "read" | "write"
) {
  posthog.capture("migration_data_source_hit", {
    source,
    domain, // "clients", "projects", "tasks", etc.
    operation,
    timestamp: Date.now(),
  });
}

// Usage in adapters
export async function fetchClients(userId: string) {
  const adapter = getClientsAdapter();
  const source = CONVEX_FLAGS.CLIENTS ? "convex" : "supabase";

  trackDataSourceHit(source, "clients", "read");

  return adapter.list(userId);
}
```

**Event:** `migration_data_source_hit`

| Property | Type | Description |
|----------|------|-------------|
| `source` | string | `"supabase"` or `"convex"` |
| `domain` | string | Domain name: `clients`, `projects`, `tasks`, etc. |
| `operation` | string | `"read"` or `"write"` |
| `timestamp` | number | Unix timestamp |

---

### Dual-Read Mismatch Events

Track when Supabase and Convex return different data during validation.

```typescript
/**
 * Track data mismatch between Supabase and Convex
 */
export function trackDualReadMismatch(
  domain: string,
  mismatchType: "count" | "data" | "missing",
  details: Record<string, unknown>
) {
  posthog.capture("migration_dual_read_mismatch", {
    domain,
    mismatchType,
    details,
    timestamp: Date.now(),
    $set: { has_migration_issues: true }, // Flag user for follow-up
  });

  // Also log to console for immediate visibility
  console.error(`[MIGRATION MISMATCH] ${domain}:`, { mismatchType, details });
}

// Usage in dual-read validation
async function validateClientsParity() {
  const [supabaseClients, convexClients] = await Promise.all([
    supabaseClientsAdapter.list(userId),
    convexClientsAdapter.list(userId),
  ]);

  if (supabaseClients.length !== convexClients.length) {
    trackDualReadMismatch("clients", "count", {
      supabaseCount: supabaseClients.length,
      convexCount: convexClients.length,
    });
  }
}
```

**Event:** `migration_dual_read_mismatch`

| Property | Type | Description |
|----------|------|-------------|
| `domain` | string | Domain where mismatch occurred |
| `mismatchType` | string | `"count"`, `"data"`, or `"missing"` |
| `details` | object | Mismatch details (counts, IDs, etc.) |
| `timestamp` | number | Unix timestamp |

---

### Migration Phase Events

Track progress through migration phases.

```typescript
/**
 * Track migration phase progress
 */
export function trackMigrationPhase(
  phase: string,
  status: "started" | "completed" | "failed",
  details?: Record<string, unknown>
) {
  posthog.capture("migration_phase_update", {
    phase,
    status,
    details,
    timestamp: Date.now(),
  });
}

// Usage in migration scripts
async function migrateClients() {
  trackMigrationPhase("phase-3a-clients", "started");

  try {
    // ... migration logic
    trackMigrationPhase("phase-3a-clients", "completed", {
      recordsProcessed: count,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    trackMigrationPhase("phase-3a-clients", "failed", {
      error: error.message,
    });
    throw error;
  }
}
```

**Event:** `migration_phase_update`

| Property | Type | Description |
|----------|------|-------------|
| `phase` | string | Phase ID: `phase-1`, `phase-2`, `phase-3a-clients`, etc. |
| `status` | string | `"started"`, `"completed"`, or `"failed"` |
| `details` | object | Optional details (records processed, duration, error) |
| `timestamp` | number | Unix timestamp |

---

### Convex Error Events

Track errors from Convex operations.

```typescript
// lib/posthog/error-tracking.ts
import { posthog } from "./client";

/**
 * Track Convex function errors
 */
export function trackConvexError(
  error: Error,
  context: {
    function: string;
    args?: Record<string, unknown>;
    source: "query" | "mutation" | "action";
  }
) {
  posthog.capture("convex_error", {
    error_message: error.message,
    error_name: error.name,
    error_stack: error.stack?.substring(0, 1000), // Truncate for PostHog
    convex_function: context.function,
    convex_source: context.source,
    args_keys: context.args ? Object.keys(context.args) : [],
    timestamp: Date.now(),
    $set: { has_convex_errors: true },
  });
}

/**
 * Wrapper for Convex calls with automatic error tracking
 */
export async function withErrorTracking<T>(
  fn: () => Promise<T>,
  context: { function: string; source: "query" | "mutation" | "action" }
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    trackConvexError(error as Error, context);
    throw error;
  }
}

// Usage
const clients = await withErrorTracking(
  () => convex.query(api.clients.list, { userId }),
  { function: "clients.list", source: "query" }
);
```

**Event:** `convex_error`

| Property | Type | Description |
|----------|------|-------------|
| `error_message` | string | Error message |
| `error_name` | string | Error type name |
| `error_stack` | string | Stack trace (truncated) |
| `convex_function` | string | Function that threw: `clients.list`, etc. |
| `convex_source` | string | `"query"`, `"mutation"`, or `"action"` |
| `args_keys` | array | Keys of arguments passed (for debugging) |
| `timestamp` | number | Unix timestamp |

---

### Feature Flag Events

Track feature flag state changes.

```typescript
/**
 * Track feature flag changes
 */
export function trackFeatureFlagChange(
  flag: string,
  enabled: boolean,
  environment: string
) {
  posthog.capture("migration_flag_changed", {
    flag,
    enabled,
    environment,
    timestamp: Date.now(),
  });
}

// Call when flags change (e.g., via deployment)
trackFeatureFlagChange("USE_CONVEX_CLIENTS", true, "production");
```

**Event:** `migration_flag_changed`

| Property | Type | Description |
|----------|------|-------------|
| `flag` | string | Flag name: `USE_CONVEX_CLIENTS`, etc. |
| `enabled` | boolean | New state |
| `environment` | string | `"development"`, `"staging"`, `"production"` |
| `timestamp` | number | Unix timestamp |

---

## PostHog Dashboard

Create a dashboard in PostHog with these panels:

### 1. Data Source Distribution (Pie Chart)

**Query:** Events where `event = "migration_data_source_hit"`
**Breakdown:** By `source` property
**Purpose:** Show % of reads going to Supabase vs Convex

### 2. Data Source by Domain (Stacked Bar)

**Query:** Events where `event = "migration_data_source_hit"`
**Breakdown:** By `domain`, then `source`
**Purpose:** See which domains are migrated

### 3. Mismatch Alerts (Table)

**Query:** Events where `event = "migration_dual_read_mismatch"`
**Columns:** `timestamp`, `domain`, `mismatchType`, `details`
**Purpose:** Alert on data consistency issues

### 4. Migration Phase Progress (Funnel/Timeline)

**Query:** Events where `event = "migration_phase_update"`
**Filter:** `status = "completed"`
**Purpose:** Track progress through phases

### 5. Convex Error Rate (Line Chart)

**Query:** Events where `event = "convex_error"`
**Formula:** Count per day
**Purpose:** Monitor error trends

### 6. Convex Errors by Function (Table)

**Query:** Events where `event = "convex_error"`
**Breakdown:** By `convex_function`
**Purpose:** Identify problematic functions

### 7. Feature Flag Status (Table/Indicator)

**Query:** Latest events where `event = "migration_flag_changed"`
**Breakdown:** By `flag`
**Purpose:** Current state of all flags

---

## Implementation Checklist

### Phase 1 Setup

- [ ] Create `lib/posthog/migration-events.ts`
- [ ] Create `lib/posthog/error-tracking.ts`
- [ ] Add PostHog tracking to adapter base class
- [ ] Create PostHog dashboard with panels above
- [ ] Test events firing correctly in development

### Per-Phase Tracking

For each migration phase:

- [ ] Call `trackMigrationPhase(phase, "started")` at start
- [ ] Call `trackMigrationPhase(phase, "completed", { details })` on success
- [ ] Call `trackMigrationPhase(phase, "failed", { error })` on failure
- [ ] Verify events appear in dashboard

### Dual-Read Validation

During dual-database period:

- [ ] Add `trackDataSourceHit()` to all data fetching functions
- [ ] Add `trackDualReadMismatch()` to validation scripts
- [ ] Monitor dashboard for mismatches daily

### Error Monitoring

- [ ] Wrap all Convex calls with `withErrorTracking()`
- [ ] Check error dashboard after each deployment
- [ ] Investigate any new error types immediately

---

## Alerting (Optional)

Consider setting up PostHog alerts for:

1. **Mismatch alert:** When `migration_dual_read_mismatch` events > 0 in 1 hour
2. **Error spike:** When `convex_error` events > 10 in 15 minutes
3. **Migration failure:** When `migration_phase_update` with `status = "failed"`

---

## Post-Migration Cleanup

After Phase 5 (Supabase sunset):

- [ ] Remove migration-specific events (optional - keep for historical reference)
- [ ] Archive dashboard or rename to "Migration History"
- [ ] Keep `convex_error` tracking for ongoing monitoring
- [ ] Remove dual-read validation code
