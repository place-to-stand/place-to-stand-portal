import 'server-only'

import { and, inArray } from 'drizzle-orm'

import { billingOpenSql } from '@pts/db/client-state'

import type { AppUser } from '@/lib/auth/session'
import {
  afterSignInsCommitted,
  discardPreparedSignIns,
  prepareClientSignIns,
  writeClientSignIns,
  type PreparedSignIn,
} from '@/lib/companies/portal-sign-ins'
import { db, type DbTx } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { applyPortalAccessInTx } from '@/lib/queries/clients/settings/client-contacts'
import { logContactClientLinkChanges } from '@/lib/queries/contacts/settings/contact-client-link-activity'
import type { ContactSavePlan } from '@/lib/settings/contacts/actions/save-contact'

import type { Undo } from './undo'

/** The companies (clients) a person gains and loses portal access to. */
export type PersonPortalPlan = { grant: string[]; revoke: string[] }

/**
 * The person sheet's portal switches, as the company sheet's People section
 * saves them: who gains and loses access with this Save. Only a billed
 * company gives access; a former client's switch can only go off. A
 * company the person leaves loses its access with the membership.
 * (`prepareContactSave` already refused anyone who can't manage clients.)
 */
export async function planPersonPortalAccess(
  plan: ContactSavePlan,
  entries: { companyId: string; portalAccess?: boolean }[] | undefined
): Promise<{ portal: PersonPortalPlan } | { error: string }> {
  const leaving = new Set(plan.membership.leave)
  const grant: string[] = []
  const revoke: string[] = []
  for (const entry of entries ?? []) {
    if (entry.portalAccess === undefined || leaving.has(entry.companyId)) {
      continue
    }
    const saved = plan.currentById.get(entry.companyId)?.portalAccess ?? false
    if (entry.portalAccess && !saved) grant.push(entry.companyId)
    if (!entry.portalAccess && saved) revoke.push(entry.companyId)
  }
  if (grant.length) {
    const billed = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(inArray(companies.id, grant), billingOpenSql()))
    if (billed.length < new Set(grant).size) {
      return {
        error: 'Bill this company before giving its people portal access.',
      }
    }
  }
  return { portal: { grant, revoke } }
}

/**
 * Turning portal access on for someone with no sign-in gives them a Client
 * sign-in on Save, as on the company sheet: the auth user is made here
 * (undone if the Save fails), the row in the transaction, the invite after.
 * Not when the sheet's own Sign-in fields give them one in this Save.
 */
export async function preparePortalSignIn(
  plan: ContactSavePlan,
  portal: PersonPortalPlan,
  options: { hasSignIn: boolean; undo: Undo }
): Promise<{ signIns: PreparedSignIn[] } | { error: string }> {
  if (!portal.grant.length || options.hasSignIn) return { signIns: [] }
  const prepared = await prepareClientSignIns([
    {
      contactId: plan.contactId,
      name: plan.values.name,
      email: plan.values.email,
    },
  ])
  if (!prepared.ok) return { error: prepared.error }
  const { signIns } = prepared
  options.undo.push(() => discardPreparedSignIns(signIns))
  return { signIns }
}

/** Writes the sign-in (if any) and the switches inside the Save's transaction. */
export async function writePersonPortalAccess(
  tx: DbTx,
  actor: AppUser,
  contactId: string,
  portal: PersonPortalPlan,
  signIns: PreparedSignIn[]
): Promise<void> {
  // Sign-in first: portal access needs one.
  await writeClientSignIns(tx, actor, signIns)
  for (const companyId of portal.grant) {
    await applyPortalAccessInTx(tx, actor, companyId, {
      grant: [contactId],
      revoke: [],
    })
  }
  for (const companyId of portal.revoke) {
    await applyPortalAccessInTx(tx, actor, companyId, {
      grant: [],
      revoke: [contactId],
    })
  }
}

/** After the commit: the invite and the access trail on each client. */
export async function finishPersonPortalAccess(
  actor: AppUser,
  contactId: string,
  portal: PersonPortalPlan,
  signIns: PreparedSignIn[]
): Promise<void> {
  if (signIns.length && portal.grant[0]) {
    await afterSignInsCommitted(actor, signIns, portal.grant[0])
  }
  await logContactClientLinkChanges(actor, [
    ...portal.grant.map(clientCompanyId => ({
      contactId,
      clientCompanyId,
      action: 'linked' as const,
    })),
    ...portal.revoke.map(clientCompanyId => ({
      contactId,
      clientCompanyId,
      action: 'unlinked' as const,
    })),
  ])
}
