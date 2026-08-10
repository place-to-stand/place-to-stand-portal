import 'server-only'

import { redirect } from 'next/navigation'

import type { AppUser } from '@/lib/auth/session'
import { fetchFormSubmissionById } from '@/lib/data/form-submissions'
import { NotFoundError } from '@/lib/errors/http'
import type { FormSubmissionRecord } from '@/lib/form-submissions/types'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type SubmissionDeepLink = {
  /** The shared row, resolved regardless of which list page/filter it sits on. */
  submission: FormSubmissionRecord | null
  /** True when the link's id is malformed or the row no longer exists. */
  notFound: boolean
}

/**
 * Resolves the `?submission=<id>` share-link param for a submissions tab.
 * Redirects to the other tab when the row's archived state doesn't match the
 * tab, so a shared link keeps working after the submission is archived or
 * restored.
 */
export async function resolveSubmissionDeepLink(
  user: AppUser,
  idParam: string | undefined,
  tab: 'active' | 'archive'
): Promise<SubmissionDeepLink> {
  if (!idParam) {
    return { submission: null, notFound: false }
  }

  // Guard the uuid cast — a malformed id would throw a DB error, not a
  // NotFoundError.
  if (!UUID_PATTERN.test(idParam)) {
    return { submission: null, notFound: true }
  }

  let submission: FormSubmissionRecord
  try {
    submission = await fetchFormSubmissionById(user, idParam, true)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { submission: null, notFound: true }
    }
    throw error
  }

  const archived = submission.deletedAt !== null

  if (archived && tab === 'active') {
    redirect(`/submissions/archive?submission=${submission.id}`)
  }

  if (!archived && tab === 'archive') {
    redirect(`/submissions?submission=${submission.id}`)
  }

  return { submission, notFound: false }
}
