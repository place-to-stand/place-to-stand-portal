import 'server-only'

import type { BulkActionResult } from '@/lib/bulk/archive-entities'
import { HttpError } from '@/lib/errors/http'

/** What one row's change came to. */
export type RowOutcome = { error?: string; warning?: string | null }

/** Rows run a few at a time: quick, without crowding the database pool. */
const CONCURRENCY = 4

/**
 * Run one row action over many rows. A refused or failing row is reported
 * and the rest carry on; warnings (closed-month notes) are de-duplicated.
 */
export async function runBulk(
  ids: string[],
  applyRow: (id: string) => Promise<RowOutcome>
): Promise<BulkActionResult> {
  const failed: BulkActionResult['failed'] = []
  const warnings = new Set<string>()
  let done = 0

  for (let start = 0; start < ids.length; start += CONCURRENCY) {
    const batch = ids.slice(start, start + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async id => {
        try {
          return await applyRow(id)
        } catch (error) {
          // Only our own refusals are worded for people; anything else
          // (a database error) stays in the logs, not in the toast.
          if (error instanceof HttpError && error.message) {
            return { error: error.message }
          }
          console.error('Bulk action row failed', id, error)
          return { error: 'Something went wrong.' }
        }
      })
    )
    results.forEach((result, index) => {
      if (result.error) {
        failed.push({ id: batch[index], error: result.error })
      } else {
        done += 1
      }
      if (result.warning) warnings.add(result.warning)
    })
  }

  return { done, failed, warnings: [...warnings] }
}
