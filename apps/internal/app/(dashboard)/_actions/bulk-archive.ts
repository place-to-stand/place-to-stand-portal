'use server'

import { z } from 'zod'

import { requirePage } from '@/lib/auth/session'
import { roleCan } from '@/lib/auth/capabilities'
import {
  BULK_ARCHIVE_ENTITIES,
  type BulkActionResult,
  type BulkArchiveEntity,
  type BulkSelectionInput,
} from '@/lib/bulk/archive-entities'

import { BULK_ARCHIVE_REGISTRY } from '../_lib/bulk-archive-registry'
import { bulkSelectionSchema, resolveBulkIds } from '../_lib/bulk-selection'
import { runBulk } from '../_lib/run-bulk'

const inputSchema = z.object({
  entity: z.enum(
    Object.keys(BULK_ARCHIVE_ENTITIES) as [
      BulkArchiveEntity,
      ...BulkArchiveEntity[],
    ]
  ),
  archive: z.boolean(),
  selection: bulkSelectionSchema,
})

/**
 * Archive (or restore) many rows of one list. Each row goes through the
 * same action as its row button, so every rule, activity entry and refusal
 * matches; a refused row is reported and the rest carry on.
 */
// permission: portal.sign_in — then the list's own capability (BULK_ARCHIVE_REGISTRY), and each row's own action checks again
export async function bulkSetArchived(input: {
  entity: BulkArchiveEntity
  archive: boolean
  selection: BulkSelectionInput
}): Promise<BulkActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { done: 0, failed: [], warnings: [], error: 'Invalid request.' }
  }
  const { entity, archive, selection } = parsed.data
  const config = BULK_ARCHIVE_REGISTRY[entity]
  const user = await requirePage('portal.sign_in')
  if (!roleCan(user.role, config.capability)) {
    return {
      done: 0,
      failed: [],
      warnings: [],
      error: 'You do not have access to do that.',
    }
  }

  // Archiving works on the active list, restoring on the archive.
  const resolved = await resolveBulkIds(user, entity, selection, !archive)
  if ('error' in resolved) {
    return { done: 0, failed: [], warnings: [], error: resolved.error }
  }

  const context = config.prepare ? await config.prepare(resolved.ids) : null
  return runBulk(resolved.ids, id =>
    config.apply(user, id, archive, context?.get(id))
  )
}
