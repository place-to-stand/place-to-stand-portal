import {
  BULK_CHUNK_SIZE,
  type BulkActionResult,
  type BulkSelectionInput,
} from './archive-entities'

/** What went wrong when a whole call fails (a timeout, a lost network). */
export const CHUNK_FAILED =
  'Something went wrong part way through. The list now shows what changed.'

/**
 * Run a bulk action over many ids a chunk at a time, so no single server
 * call runs long, and add up the results. A call that throws or returns an
 * error stops the run; the rows already done stay done and are counted.
 */
export async function runInChunks(
  ids: string[],
  action: (input: BulkSelectionInput) => Promise<BulkActionResult>,
  chunkSize = BULK_CHUNK_SIZE
): Promise<BulkActionResult> {
  const total: BulkActionResult = { done: 0, failed: [], warnings: [] }
  for (let start = 0; start < ids.length; start += chunkSize) {
    let result: BulkActionResult
    try {
      result = await action({
        kind: 'ids',
        ids: ids.slice(start, start + chunkSize),
      })
    } catch {
      return { ...total, error: CHUNK_FAILED }
    }
    total.done += result.done
    total.failed.push(...result.failed)
    for (const warning of result.warnings) {
      if (!total.warnings.includes(warning)) total.warnings.push(warning)
    }
    if (result.error) return { ...total, error: result.error }
  }
  return total
}
