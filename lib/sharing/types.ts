/**
 * Interface for entities that support share links.
 */
export interface ShareableEntity {
  id: string
  shareToken: string | null
  shareEnabled: boolean | null
}
