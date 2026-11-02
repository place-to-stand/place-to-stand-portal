/** Archiving and restoring a company. */
import 'server-only'

import { billingOpenSql, wasClientCompany } from '@pts/db/client-state'

import { and, eq, sql } from 'drizzle-orm'

import { companyArchivedEvent, companyRestoredEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { roleCan } from '@/lib/auth/capabilities'
import { isAdminRole } from '@/lib/auth/roles'
import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import type { CompanyActionResult } from '@/lib/companies/types'
import { db, uniqueViolation } from '@/lib/db'
import {
  logContactClientLinkChanges,
  type ContactClientLinkChange,
} from '@/lib/queries/contacts/settings/contact-client-link-activity'
import { revokeCompanyPortalAccess } from '@/lib/companies/billing/revoke-company-portal-access'
import { ARCHIVE_BILLED_REFUSAL } from '@/lib/companies/archive-refusal'
import { companies } from '@/lib/db/schema'
import { CompanySaveRefusal, companyHasClient } from '@/lib/companies/write'


/**
 * Archiving keeps the company's contacts and leads linked, so a restore
 * brings them back. A company whose billing is still open (billed now, or
 * through the end of this month) can't be archived: stop billing first.
 * Archiving a former client switches off its people's portal access, and a
 * restore doesn't switch it back on.
 */
export async function setCompanyArchived(
  actor: AppUser,
  companyId: string,
  archived: boolean
): Promise<CompanyActionResult> {
  assertCrmAccess(actor)

  const [existing] = await db
    .select({
      id: companies.id,
      name: companies.name,
      deletedAt: companies.deletedAt,
      isStaff: companies.isStaff,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)

  if (!existing) {
    return { ok: false, error: 'Company not found.' }
  }
  if (Boolean(existing.deletedAt) === archived) {
    return { ok: true, id: existing.id }
  }

  // Staff sign in as members of the agency's own company.
  if (existing.isStaff && !isAdminRole(actor.role)) {
    return { ok: false, error: `Only an admin can change ${existing.name}.` }
  }

  // Client records are admin-only, and a client is its company (same rule
  // as rename and people).
  if (
    !roleCan(actor.role, 'clients.manage') &&
    (await companyHasClient(existing.id))
  ) {
    return {
      ok: false,
      error: archived
        ? 'This company is a client, so only an admin can archive it.'
        : 'This company is a client, so only an admin can restore it.',
    }
  }

  if (archived && (await companyHasClient(existing.id))) {
    return { ok: false, error: ARCHIVE_BILLED_REFUSAL }
  }

  const timestamp = new Date().toISOString()
  let accessChanges: ContactClientLinkChange[] = []

  try {
    await db.transaction(async tx => {
      if (archived) {
        // Re-checked under the row lock the company sheet's Save takes, so a
        // billing restart saved meanwhile can't slip past the check above.
        const [locked] = await tx
          .select({ billingOpen: sql<boolean>`${billingOpenSql()}` })
          .from(companies)
          .where(eq(companies.id, companyId))
          .for('update')
        if (locked?.billingOpen) {
          throw new CompanySaveRefusal(ARCHIVE_BILLED_REFUSAL)
        }
      }
      await tx
        .update(companies)
        .set({ deletedAt: archived ? timestamp : null, updatedAt: timestamp })
        .where(eq(companies.id, companyId))
      if (!archived) return
      // Archiving a former client ends its people's portal access, so a
      // later restart doesn't bring it back unasked.
      const [client] = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.id, companyId), wasClientCompany()))
        .limit(1)
      if (client) {
        accessChanges = await revokeCompanyPortalAccess(
          tx,
          companyId,
          client.id
        )
      }
    })
  } catch (error) {
    if (error instanceof CompanySaveRefusal) {
      return { ok: false, error: error.message }
    }
    if (!archived && uniqueViolation(error)) {
      return {
        ok: false,
        error: 'Another company already uses this name. Rename one first.',
      }
    }
    console.error('Failed to change company archive state', error)
    return { ok: false, error: 'Unable to update the company.' }
  }

  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    targetType: 'COMPANY',
    targetId: existing.id,
    ...(archived
      ? companyArchivedEvent({ name: existing.name })
      : companyRestoredEvent({ name: existing.name })),
  })
  await logContactClientLinkChanges(actor, accessChanges)

  return { ok: true, id: existing.id }
}
