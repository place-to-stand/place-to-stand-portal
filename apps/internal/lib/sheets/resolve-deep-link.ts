import 'server-only'

import { redirect } from 'next/navigation'

import { NotFoundError } from '@/lib/errors/http'

import { NEW_SHEET_VALUE, UUID_PATTERN } from './entities'

export type SheetDeepLink<T> = {
  /** The linked record, resolved regardless of pagination/filters. */
  record: T | null
  /** True when the link's id is malformed or the record no longer exists. */
  notFound: boolean
}

type ResolveSheetDeepLinkArgs<T> = {
  /** Raw param value from `searchParams` (may be `new`, malformed, absent). */
  idParam: string | undefined
  /**
   * Fetch the record by id ignoring the page's pagination/filters. May throw
   * `NotFoundError` or resolve `null` for a missing record — both are
   * treated as not found.
   */
  fetchById: (id: string) => Promise<T | null>
  /**
   * Cross-tab redirect: when provided along with `isArchived`, a link opened
   * on the wrong tab redirects to the matching one so shared links keep
   * working after archive/restore (submissions precedent).
   */
  tab?: 'active' | 'archive'
  isArchived?: (record: T) => boolean
  activeHref?: (id: string) => string
  archiveHref?: (id: string) => string
}

export async function resolveSheetDeepLink<T>({
  idParam,
  fetchById,
  tab,
  isArchived,
  activeHref,
  archiveHref,
}: ResolveSheetDeepLinkArgs<T>): Promise<SheetDeepLink<T>> {
  // `new` opens the create sheet — nothing to resolve.
  if (!idParam || idParam === NEW_SHEET_VALUE) {
    return { record: null, notFound: false }
  }

  // Guard the uuid cast — a malformed id would throw a DB error, not a
  // NotFoundError.
  if (!UUID_PATTERN.test(idParam)) {
    return { record: null, notFound: true }
  }

  let record: T | null
  try {
    record = await fetchById(idParam)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { record: null, notFound: true }
    }
    throw error
  }

  if (record === null) {
    return { record: null, notFound: true }
  }

  if (tab && isArchived) {
    const archived = isArchived(record)
    if (archived && tab === 'active' && archiveHref) {
      redirect(archiveHref(idParam))
    }
    if (!archived && tab === 'archive' && activeHref) {
      redirect(activeHref(idParam))
    }
  }

  return { record, notFound: false }
}
