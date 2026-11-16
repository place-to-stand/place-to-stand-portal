import 'server-only'

import { archiveLead } from '../leads/_actions/archive-lead'
import { restoreLead } from '../leads/_actions/restore-lead'
import { removeTask } from '../projects/actions/remove-task'
import { restoreTask } from '../projects/actions/restore-task'
import type { BulkArchiveConfig } from './bulk-archive-registry'

/**
 * Boards act on the cards picked and never ask for every match; a call that
 * does anyway matches nothing.
 */
async function boardHasNoMatching(): Promise<string[]> {
  return []
}

/**
 * Board cards (tasks, leads) in the bulk archive: each card goes through
 * its card menu's own archive (and its archive tab's restore).
 */
export const BOARD_BULK_ARCHIVE = {
  task: {
    capability: 'projects.view_member',
    matchingIds: boardHasNoMatching,
    apply: async (_user, id, archive) => {
      const result = archive
        ? await removeTask({ taskId: id })
        : await restoreTask({ taskId: id })
      return { error: result.error }
    },
  },
  lead: {
    capability: 'leads.manage',
    matchingIds: boardHasNoMatching,
    apply: async (_user, id, archive) => {
      const result = archive
        ? await archiveLead({ leadId: id })
        : await restoreLead({ leadId: id })
      return result.success
        ? {}
        : { error: result.error ?? 'Unable to change lead.' }
    },
  },
} satisfies Record<'task' | 'lead', BulkArchiveConfig>
