import 'server-only'

import { revalidateLeadsPath } from '@/app/(dashboard)/leads/_actions/utils'
import type { AppUser } from '@/lib/auth/session'
import { BadRequestError, NotFoundError } from '@/lib/errors/http'
import type { SaveLeadResult } from '@/lib/leads/save-lead-core'

import { jsonOk } from './handler'
import { getLeadForCli } from './queries/leads'
import { resolveUserIds } from './queries/users'
import { serializeLead } from './serializers/lead'

/** A user UUID or email, or null to unassign. */
export async function resolveLeadAssignee(
  user: AppUser,
  reference: string | null | undefined
): Promise<string | null> {
  if (!reference) {
    return null
  }

  const [id] = await resolveUserIds(user, [reference])

  return id ?? null
}

/**
 * Turns a `SaveLeadResult` into an HTTP response. Unlike tasks there is no
 * partial-success case — the lead write is one row plus its history — so a
 * failed result never left anything behind and is safe to surface as 4xx.
 */
export async function respondToLeadWrite(
  user: AppUser,
  result: SaveLeadResult,
  status: number
) {
  if (!result.success || !result.leadId) {
    if (result.notFound) {
      throw new NotFoundError(result.error ?? 'Lead not found.')
    }

    throw new BadRequestError(result.error ?? 'Unable to save lead.')
  }

  revalidateLeadsPath()

  return jsonOk(serializeLead(await getLeadForCli(user, result.leadId)), {
    status,
  })
}
