/**
 * The company and person a lead save links to: found, created or edited
 * inside the save's transaction. `save-lead-core.ts` owns the lead itself.
 */
import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import {
  contactCreatedEvent,
  contactRestoredEvent,
  contactUpdatedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { isAdminRole } from '@/lib/auth/roles'
import type { AppUser } from '@/lib/auth/session'
import type { DbTx } from '@/lib/db'
import { companies, contacts } from '@/lib/db/schema'
import {
  findOrCreateCompanyByName,
  getLinkableCompany,
  type DeferActivity,
} from '@/lib/companies/find-or-create'
import { joinCompany, mainCompanyIdSql } from '@/lib/queries/memberships'

import type { SaveLeadResult } from './save-lead-core'
import type { NormalizedLead } from './save-lead-fields'

export type SaveContext = {
  tx: DbTx
  actor: AppUser
  /** Runs after commit: activity rows and notifications. */
  defer: DeferActivity
}

/** Rolls the transaction back and carries the refusal out of it. */
export class SaveRefused extends Error {
  constructor(readonly result: SaveLeadResult) {
    super(result.error ?? 'Lead save refused')
  }
}

/**
 * Which company a save links the lead to. The sheet's picker sends
 * `companyId` (null clears it). The CLI and MCP send a name instead: an
 * unchanged name keeps its link, a new one finds or creates the company, and
 * a blank one clears it.
 */
export async function resolveLeadCompany(
  { tx, actor, defer }: SaveContext,
  normalized: NormalizedLead,
  existing?: { companyId: string | null; companyName: string | null }
): Promise<
  { company: { id: string; name: string } | null } | { error: string }
> {
  if (normalized.companyId !== undefined) {
    if (normalized.companyId === null) return { company: null }
    const company = await getLinkableCompany(normalized.companyId, tx)
    return company
      ? { company }
      : { error: 'That company no longer exists. Pick another.' }
  }

  const nameUnchanged =
    (existing?.companyName ?? '').trim().toLowerCase() ===
    (normalized.companyName ?? '').trim().toLowerCase()
  if (existing?.companyId && nameUnchanged) {
    return {
      company: { id: existing.companyId, name: existing.companyName ?? '' },
    }
  }
  return {
    company: await findOrCreateCompanyByName(actor, normalized.companyName, {
      website: normalized.companyWebsite,
      executor: tx,
      defer,
    }),
  }
}

export type LeadContact = {
  id: string
  name: string
  email: string | null
  phone: string | null
}

/**
 * Which contact a save links the lead to; the lead reads its name, email and
 * phone from it. The sheet's picker sends `contactId`. The CLI,
 * MCP and intake send contact fields instead: an existing lead edits its
 * linked contact; a new lead links the contact with that email, or a new
 * contact (name-only when there's no email).
 */
export async function resolveLeadContact(
  { tx, actor, defer }: SaveContext,
  normalized: NormalizedLead,
  companyId: string | null,
  existing?: { contactId: string | null }
): Promise<{ contact: LeadContact } | { error: string }> {
  const fields = {
    id: contacts.id,
    name: contacts.name,
    email: contacts.email,
    phone: contacts.phone,
    hasCompany: sql<boolean>`${mainCompanyIdSql(contacts.id)} is not null`,
    userId: contacts.userId,
  }
  const timestamp = new Date().toISOString()
  const isAdmin = isAdminRole(actor.role)
  // Someone who can sign in is edited by admins only (their companies decide
  // what they can see), as on the person sheet. A lead save still links
  // them; it just leaves them be. A client's other people are Sales'
  // directory to edit (name and phone; an email change relinks the lead).
  const isLocked = (contact: { userId: string | null }) =>
    Boolean(contact.userId) && !isAdmin

  // Saving a lead puts its person at its company, any company, clients
  // included: building the directory is open to Sales. Membership grants no
  // client access (portal access starts off and is switched on per person by
  // an admin). People who can sign in and the staff company stay admin-only.
  const linkCompany = async (contact: {
    id: string
    hasCompany: boolean
    userId: string | null
  }) => {
    if (!companyId) return
    if (contact.userId && !isAdmin) return
    if (!isAdmin) {
      const [staff] = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.isStaff, true)))
        .limit(1)
      if (staff) return
    }
    await joinCompany(tx, contact.id, companyId)
  }

  if (normalized.contactId) {
    const [contact] = await tx
      .select(fields)
      .from(contacts)
      .where(
        and(eq(contacts.id, normalized.contactId), isNull(contacts.deletedAt))
      )
      .limit(1)
    if (!contact)
      return { error: 'That person no longer exists. Pick another.' }
    await linkCompany(contact)
    return { contact }
  }

  const email = normalized.contactEmail?.trim().toLowerCase() || null
  const details = {
    name: normalized.contactName,
    email,
    phone: normalized.contactPhone,
  }

  // An existing lead keeps its contact unless the email now names someone
  // else. Name and phone edits update the contact in place (its other leads
  // read it too); an email change relinks the lead instead, so a correction
  // never renames a contact other records share.
  if (existing?.contactId) {
    const [contact] = await tx
      .select(fields)
      .from(contacts)
      .where(
        and(eq(contacts.id, existing.contactId), isNull(contacts.deletedAt))
      )
      .limit(1)
    const sameEmail =
      (contact?.email ?? '').toLowerCase() === (details.email ?? '')
    if (contact && sameEmail) {
      const locked = isLocked(contact)
      const changed =
        !locked &&
        (contact.name !== details.name ||
          (contact.phone ?? null) !== details.phone)
      if (changed) {
        await tx
          .update(contacts)
          .set({
            name: details.name,
            phone: details.phone,
            updatedAt: timestamp,
          })
          .where(eq(contacts.id, contact.id))
        const event = contactUpdatedEvent({
          email: contact.email,
          name: details.name,
          changedFields: [
            ...(contact.name !== details.name ? ['name'] : []),
            ...((contact.phone ?? null) !== details.phone ? ['phone'] : []),
          ],
          details: {
            before: { name: contact.name, phone: contact.phone },
            after: { name: details.name, phone: details.phone },
          },
        })
        defer(() =>
          logActivity({
            actorId: actor.id,
            actorRole: actor.role,
            targetType: 'CONTACT',
            targetId: contact.id,
            ...event,
          })
        )
      }
      await linkCompany(contact)
      return {
        contact: {
          id: contact.id,
          name: locked ? contact.name : details.name,
          // Keep the contact's own spelling of its email.
          email: contact.email,
          phone: locked ? contact.phone : details.phone,
        },
      }
    }
  }

  if (email) {
    // Same rule as the 0096 backfill: a live contact wins, then an
    // exact-case match, then the oldest. An archived match is restored,
    // since a live lead now points at them.
    const [match] = await tx
      .select({ ...fields, deletedAt: contacts.deletedAt })
      .from(contacts)
      .where(sql`lower(${contacts.email}) = ${email}`)
      .orderBy(
        sql`${contacts.deletedAt} is not null`,
        sql`${contacts.email} = ${email} desc`,
        contacts.createdAt
      )
      .limit(1)
    if (match) {
      if (match.deletedAt) {
        // Restoring someone who can sign in is admin-only (as on the
        // person sheet).
        if (match.userId && !isAdmin) {
          return {
            error:
              'That email belongs to an archived person who can sign in. Ask an admin to restore them.',
          }
        }
        await tx
          .update(contacts)
          .set({ deletedAt: null, updatedAt: timestamp })
          .where(eq(contacts.id, match.id))
        defer(() =>
          logActivity({
            actorId: actor.id,
            actorRole: actor.role,
            targetType: 'CONTACT',
            targetId: match.id,
            ...contactRestoredEvent({ email: match.email, name: match.name }),
          })
        )
      }
      await linkCompany(match)
      return {
        contact: {
          id: match.id,
          name: match.name,
          email: match.email,
          phone: match.phone,
        },
      }
    }
  }

  const [created] = await tx
    .insert(contacts)
    .values({ ...details, createdBy: actor.id })
    .returning({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
    })
  if (!created) return { error: 'Unable to save the person.' }
  await linkCompany({ id: created.id, hasCompany: false, userId: null })

  defer(() =>
    logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'CONTACT',
      targetId: created.id,
      ...contactCreatedEvent({ email: created.email, name: created.name }),
    })
  )
  return { contact: created }
}
