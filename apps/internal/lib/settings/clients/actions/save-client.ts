import { and, eq, isNull, ne } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import {
  clientSchema,
  type ClientInput,
} from '@/lib/settings/clients/client-service'

import {
  buildMutationResult,
  type ClientMutationContext,
  type ClientMutationResult,
} from './types'
import { createClient } from './create-client'
import { updateClient } from './update-client'
import { getLinkableCompany } from '@/lib/queries/companies'
import { clientDisplayName } from '@/lib/companies/client-name'

export async function saveClientMutation(
  context: ClientMutationContext,
  input: ClientInput
): Promise<ClientMutationResult> {
  const parsed = clientSchema.safeParse(input)

  if (!parsed.success) {
    return buildMutationResult({
      error: parsed.error.issues[0]?.message ?? 'Invalid client payload.',
    })
  }

  const {
    id,
    name,
    slug,
    notes,
    memberIds,
    billingType,
    billingEffective,
    commissionEffective,
    state,
    website,
    originationContactId,
    originationUserId,
    closers,
    companyId,
  } = parsed.data
  const normalizedMemberIds = memberIds
    ? Array.from(new Set(memberIds)).filter(Boolean)
    : undefined

  // A client is named after its company, and a company has one client.
  let trimmedName = name.trim()
  if (companyId) {
    const company = await getLinkableCompany(companyId)
    if (!company) {
      return buildMutationResult({ error: 'That company no longer exists.' })
    }
    const [taken] = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(
        and(
          eq(clients.companyId, companyId),
          isNull(clients.deletedAt),
          id ? ne(clients.id, id) : undefined
        )
      )
      .limit(1)
    if (taken) {
      return buildMutationResult({
        error: `${company.name} already has a client. A company has one client.`,
      })
    }
    trimmedName = clientDisplayName(company.name)
  }

  if (!trimmedName) {
    return buildMutationResult({ error: 'Pick the company this client is.' })
  }

  const cleanedNotes = notes?.trim() ? notes.trim() : null
  const cleanedWebsite = website?.trim() ? website.trim() : null
  const providedSlug = slug?.trim() || null
  const mode = id ? 'edit' : 'create'

  return trackSettingsServerInteraction(
    {
      entity: 'client',
      mode,
      targetId: id ?? null,
      metadata: {
        hasMembers: normalizedMemberIds ? normalizedMemberIds.length > 0 : undefined,
      },
    },
    async () => {
      if (!id) {
        return createClient(context, {
          name: trimmedName,
          providedSlug,
          billingType,
          state: state ?? null,
          website: cleanedWebsite,
          originationContactId,
          originationUserId,
          closers,
          notes: cleanedNotes,
          memberIds: normalizedMemberIds,
          companyId: companyId ?? null,
        })
      }

      return updateClient(context, {
        id,
        name: trimmedName,
        providedSlug,
        billingType,
        billingEffective,
        commissionEffective,
        state: state ?? null,
        website: cleanedWebsite,
        originationContactId,
        originationUserId,
        closers,
        notes: cleanedNotes,
        memberIds: normalizedMemberIds,
        companyId,
      })
    }
  )
}
