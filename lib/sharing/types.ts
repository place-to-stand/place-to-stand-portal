/**
 * Common interface for entities that support token-based sharing.
 * Any table with share_token + share_enabled columns can implement this.
 */
export type ShareableEntity = {
  id: string
  shareToken: string | null
  shareEnabled: boolean | null
  sharePasswordHash?: string | null
  viewedAt?: string | null
  viewedCount?: number | null
}
