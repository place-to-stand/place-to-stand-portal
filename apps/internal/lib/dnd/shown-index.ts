/**
 * A drop index counts only the cards on screen, but a filtered board's
 * column also holds cards the filter hides. Turn the index into a place in
 * the whole column: just before the shown card now at `index`, or just after
 * the last shown card when dropped at the end, so hidden cards keep their
 * order around it.
 */
export function shownIndexToBucketIndex(
  bucket: readonly { taskId: string }[],
  hiddenTaskIds: ReadonlySet<string>,
  index: number
): number {
  const clamp = (value: number, max: number) =>
    Math.min(Math.max(value, 0), max)
  if (!hiddenTaskIds.size) return clamp(index, bucket.length)
  const shown = bucket.flatMap((entry, at) =>
    hiddenTaskIds.has(entry.taskId) ? [] : [at]
  )
  const bounded = clamp(index, shown.length)
  if (bounded < shown.length) return shown[bounded]
  return shown.length ? shown[shown.length - 1] + 1 : bucket.length
}
