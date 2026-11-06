'use server'

import { z } from 'zod'

import { requirePage } from '@/lib/auth/session'
import { roleCan } from '@/lib/auth/capabilities'
import {
  BULK_ACTION_LIMIT,
  BULK_ARCHIVE_ENTITIES,
  countLabel,
  type BulkActionResult,
  type BulkArchiveEntity,
  type BulkSelectionInput,
} from '@/lib/bulk/archive-entities'
import { UUID_PATTERN } from '@/lib/sheets/entities'

import {
  BULK_ARCHIVE_REGISTRY,
  BulkTooLargeError,
} from '../_lib/bulk-archive-registry'

const inputSchema = z.object({
  entity: z.enum(
    Object.keys(BULK_ARCHIVE_ENTITIES) as [
      BulkArchiveEntity,
      ...BulkArchiveEntity[],
    ]
  ),
  archive: z.boolean(),
  selection: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('ids'),
      ids: z
        .array(z.string().regex(UUID_PATTERN))
        .min(1)
        .max(BULK_ACTION_LIMIT),
    }),
    z.object({
      kind: z.literal('matching'),
      params: z.record(z.string(), z.string()),
    }),
  ]),
})

/** Rows run a few at a time: quick, without crowding the database pool. */
const CONCURRENCY = 4

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

  let ids: string[]
  try {
    ids =
      selection.kind === 'ids'
        ? [...new Set(selection.ids)]
        : await config.matchingIds(
            user,
            selection.params,
            // Archiving works on the active list, restoring on the archive.
            !archive,
            BULK_ACTION_LIMIT
          )
  } catch (error) {
    if (error instanceof BulkTooLargeError) {
      return {
        done: 0,
        failed: [],
        warnings: [],
        error: `That is more than ${countLabel(entity, BULK_ACTION_LIMIT)}. Narrow the filters and try again.`,
      }
    }
    throw error
  }

  const context = config.prepare ? await config.prepare(ids) : null
  const failed: BulkActionResult['failed'] = []
  const warnings = new Set<string>()
  let done = 0

  for (let start = 0; start < ids.length; start += CONCURRENCY) {
    const batch = ids.slice(start, start + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async id => {
        try {
          return await config.apply(user, id, archive, context?.get(id))
        } catch (error) {
          return {
            error:
              error instanceof Error && error.message
                ? error.message
                : 'Something went wrong.',
          }
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
