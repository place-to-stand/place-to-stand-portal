import 'server-only'

import { z } from 'zod'

import type { AppUser } from '@/lib/auth/session'
import {
  BULK_ACTION_LIMIT,
  countLabel,
  type BulkArchiveEntity,
  type BulkSelectionInput,
} from '@/lib/bulk/archive-entities'
import { UUID_PATTERN } from '@/lib/sheets/entities'

import {
  BULK_ARCHIVE_REGISTRY,
  BulkTooLargeError,
} from './bulk-archive-registry'

/** Ticked ids, or "every row matching these list params". */
export const bulkSelectionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ids'),
    ids: z.array(z.string().regex(UUID_PATTERN)).min(1).max(BULK_ACTION_LIMIT),
  }),
  z.object({
    kind: z.literal('matching'),
    params: z.record(z.string(), z.string()),
  }),
])

/**
 * The ids a bulk action covers: the ticked ones, or every row the list shows
 * for its params (`archived` reads the Archive tab). Too many rows is an
 * error message for the person, not a throw.
 */
export async function resolveBulkIds(
  user: AppUser,
  entity: BulkArchiveEntity,
  selection: BulkSelectionInput,
  archived: boolean
): Promise<{ ids: string[] } | { error: string }> {
  if (selection.kind === 'ids') return { ids: [...new Set(selection.ids)] }
  try {
    return {
      ids: await BULK_ARCHIVE_REGISTRY[entity].matchingIds(
        user,
        selection.params,
        archived,
        BULK_ACTION_LIMIT
      ),
    }
  } catch (error) {
    if (error instanceof BulkTooLargeError) {
      return {
        error: `That is more than ${countLabel(entity, BULK_ACTION_LIMIT)}. Narrow the filters and try again.`,
      }
    }
    throw error
  }
}
