/**
 * Provider-specific sync state types for OAuth connections.
 *
 * Each provider stores different checkpoint data for incremental syncing:
 * - Gmail: historyId for history.list API
 * - GitHub: etag/since timestamps for conditional requests
 *
 * The syncState JSONB column on oauth_connections stores this data,
 * allowing each provider to track its own sync progress.
 */

/**
 * Gmail sync state using historyId for incremental sync via history.list API.
 * @see https://developers.google.com/workspace/gmail/api/guides/sync
 */
export type GmailSyncState = {
  /** Gmail historyId - used as startHistoryId for incremental sync */
  historyId?: string
  /** Whether a full sync has been completed at least once */
  fullSyncCompleted?: boolean
  /** Timestamp of last successful sync (ISO string) */
  lastSyncedAt?: string
  /** Number of messages synced in last operation */
  lastSyncCount?: number
  /** Error message from last sync attempt (null if successful) */
  lastError?: string | null
}

/**
 * GitHub sync state for repository/notification syncing.
 * Uses ETags and timestamps for conditional requests.
 */
export type GitHubSyncState = {
  /** ETag for conditional GET requests */
  etag?: string
  /** Last-Modified header for conditional requests */
  lastModified?: string
  /** Timestamp for filtering (e.g., notifications since) */
  since?: string
}

/**
 * Union type for all provider sync states.
 * Use type guards to narrow based on provider.
 */
export type ProviderSyncState = GmailSyncState | GitHubSyncState | Record<string, unknown>

/**
 * Type guard for Gmail sync state
 */
export function isGmailSyncState(state: unknown): state is GmailSyncState {
  if (!state || typeof state !== 'object') return false
  const s = state as Record<string, unknown>
  // Gmail state has historyId, fullSyncCompleted, or lastError
  return 'historyId' in s || 'fullSyncCompleted' in s || 'lastError' in s || Object.keys(s).length === 0
}

/**
 * Type guard for GitHub sync state
 */
export function isGitHubSyncState(state: unknown): state is GitHubSyncState {
  if (!state || typeof state !== 'object') return false
  const s = state as Record<string, unknown>
  return 'etag' in s || 'lastModified' in s || 'since' in s
}
