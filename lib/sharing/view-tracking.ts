/**
 * Generic view recording helper with status guard.
 * Only records a view if the entity is in a viewable status (e.g., SENT).
 *
 * @param currentStatus - The entity's current status
 * @param viewableStatuses - Statuses where view tracking is meaningful
 * @param recordFn - Callback that performs the actual view recording (DB update)
 * @returns true if view was recorded, false if skipped
 */
export async function recordView(
  currentStatus: string,
  viewableStatuses: string[],
  recordFn: () => Promise<void>
): Promise<boolean> {
  if (!viewableStatuses.includes(currentStatus)) {
    return false
  }

  await recordFn()
  return true
}
