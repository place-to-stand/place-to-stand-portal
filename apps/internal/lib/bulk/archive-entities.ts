/**
 * The lists that can archive (and restore) many rows at once, and the words
 * each one uses. Client-safe: the bulk bar and its confirm dialog read the
 * labels, the server action reads the keys.
 */
export const BULK_ARCHIVE_ENTITIES = {
  company: {
    singular: 'company',
    plural: 'companies',
    list: 'the Companies list',
  },
  contact: { singular: 'person', plural: 'people', list: 'active people' },
  hourBlock: {
    singular: 'hour block',
    plural: 'hour blocks',
    list: 'active hour blocks',
  },
  invoice: {
    singular: 'invoice',
    plural: 'invoices',
    list: 'active invoices',
  },
  project: {
    singular: 'project',
    plural: 'projects',
    list: 'active projects',
  },
  submission: {
    singular: 'submission',
    plural: 'submissions',
    list: 'the Submissions list',
  },
  timeLog: {
    singular: 'time log',
    plural: 'time logs',
    list: 'time logs',
  },
} as const

export type BulkArchiveEntity = keyof typeof BULK_ARCHIVE_ENTITIES

/** The most rows one bulk action touches. */
export const BULK_ACTION_LIMIT = 500

/**
 * Which rows a bulk action covers: the ticked ones, or every row matching
 * the list's current filters (its URL params), across all pages.
 */
export type BulkSelectionInput =
  | { kind: 'ids'; ids: string[] }
  | { kind: 'matching'; params: Record<string, string> }

export type BulkActionResult = {
  /** Rows changed. */
  done: number
  /** Rows the action refused, with the reason the single action gives. */
  failed: { id: string; error: string }[]
  /** Non-blocking notes (closed-month changes), each once. */
  warnings: string[]
  /** Set when nothing ran (no access, too many rows, bad input). */
  error?: string
}

export function countLabel(entity: BulkArchiveEntity, count: number) {
  const words = BULK_ARCHIVE_ENTITIES[entity]
  return `${count} ${count === 1 ? words.singular : words.plural}`
}
