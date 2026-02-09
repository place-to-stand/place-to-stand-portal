/**
 * Generic helper concept for recording first-view timestamps on shareable entities.
 * Each entity implements its own view tracking due to Drizzle's strict typing.
 *
 * Pattern:
 * 1. Check if entity has been viewed before.
 * 2. If first view, set viewedAt timestamp.
 * 3. Always increment viewedCount.
 */
export type ViewTrackingResult = {
  previousCount: number
  isFirstView: boolean
}
