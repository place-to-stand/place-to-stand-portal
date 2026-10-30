import { wasClientCompany, clientEndedAtSql } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import { and, eq, isNull, ne } from 'drizzle-orm'

import { db } from '@/lib/db'
import { companies, } from '@/lib/db/schema'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import {
  clientSchema,
  type ClientInput,
} from '@/lib/companies/billing/client-service'

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

  // A client is named after its company, and a company has one client.
  let trimmedName = name.trim()
  if (companyId) {
    const company = await getLinkableCompany(companyId)
    if (!company) {
      return buildMutationResult({ error: 'That company no longer exists.' })
    }
    const [taken] = await db
      .select({ id: companies.id, name: clientNameSql })
      .from(companies)
      .where(and(wasClientCompany(), and(
          eq(companies.id, companyId),
          isNull(clientEndedAtSql),
          id ? ne(companies.id, id) : undefined
        )))
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
        companyId,
      })
    }
  )
}
