import { randomUUID } from 'node:crypto'

import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import {
  contactCreatedEvent,
  contactUpdatedEvent,
} from '@/lib/activity/events/contacts'
import { roleCan } from '@/lib/auth/capabilities'
import { assertCrmAccess } from '@/lib/auth/permissions'
import { isAdminRole } from '@/lib/auth/roles'
import { CLIENT_PRIMARY_ADMIN_ONLY } from '@/lib/companies/people-copy'
import { PERSON_WITH_SIGN_IN_ADMIN_ONLY } from '@/lib/settings/contacts/person-sheet-copy'
import type { AppUser } from '@/lib/auth/session'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import {
  logContactClientLinkChanges,
  type ContactClientLinkChange,
} from '@/lib/queries/contacts/settings/contact-client-link-activity'
import { db, type DbTx } from '@/lib/db'
import { companies, contacts, memberships } from '@/lib/db/schema'
import { isClientCompany } from '@pts/db/client-state'
import {
  findOrCreateCompanyByName,
  getLinkableCompany,
} from '@/lib/queries/companies'
import {
  joinCompany,
  leaveCompany,
  setMembershipTitle,
} from '@/lib/queries/memberships'
import {
  contactSchema,
  type ContactInput,
} from '@/lib/settings/contacts/contact-service'

import {
  buildMutationResult,
  type ContactMutationContext,
  type ContactMutationResult,
} from './types'

type DesiredMembership = {
  companyId: string
  title: string | null | undefined
}

type CurrentMembership = {
  companyId: string
  companyName: string
  title: string | null
  isPrimary: boolean
  portalAccess: boolean
  clientCompanyId: string | null
}

type MembershipPlan = ReturnType<typeof planMembershipChanges>

/** The person's saved fields, as read before a save. */
export type ExistingContact = {
  id: string
  email: string | null
  name: string
  phone: string | null
  linkedinUrl: string | null
  userId: string | null
  avatarUrl: string | null
  deletedAt: string | null
  updatedAt: string
}

/**
 * Everything a person save writes, worked out (and permission-checked)
 * before the transaction, so the writes themselves can share one
 * transaction with the rest of the sheet (photo, sign-in).
 */
export type ContactSavePlan = {
  mode: 'create' | 'update'
  /** The person's id; on create, chosen up front so the photo can use it. */
  contactId: string
  values: {
    email: string | null
    name: string
    phone: string | null
    linkedinUrl: string | null
  }
  existing: ExistingContact | null
  membership: MembershipPlan
  currentById: Map<string, CurrentMembership>
  changedFields: string[]
  before: Record<string, unknown>
  after: Record<string, unknown>
}

/**
 * The one-company shorthand (`companyId` / `companyName` + `jobTitle`):
 * the company to join, or null for none. `companyId` wins; a name finds or
 * creates the company.
 */
async function resolveShorthandCompany(
  user: AppUser,
  companyId: string | null | undefined,
  companyName: string | null | undefined
): Promise<string | null> {
  if (companyId) {
    const company = await getLinkableCompany(companyId)
    if (!company) throw new Error('That company no longer exists.')
    return company.id
  }
  if (!companyName) return null
  const company = await findOrCreateCompanyByName(user, companyName)
  return company?.id ?? null
}

async function loadCurrentMemberships(
  contactId: string
): Promise<CurrentMembership[]> {
  return db
    .select({
      companyId: memberships.companyId,
      companyName: companies.name,
      title: memberships.title,
      isPrimary: memberships.isPrimary,
      portalAccess: memberships.portalAccess,
      // A company billed now is its own client.
      clientCompanyId: sql<
        string | null
      >`case when ${isClientCompany()} then ${companies.id} end`,
    })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .where(
      and(eq(memberships.contactId, contactId), isNull(memberships.endedAt))
    )
}

export async function loadExistingContact(
  contactId: string
): Promise<ExistingContact | null> {
  const [existing] = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      phone: contacts.phone,
      linkedinUrl: contacts.linkedinUrl,
      userId: contacts.userId,
      avatarUrl: contacts.avatarUrl,
      deletedAt: contacts.deletedAt,
      updatedAt: contacts.updatedAt,
    })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1)
  return existing ?? null
}

export function isEmailConflict(error: unknown) {
  return (
    error instanceof Error &&
    String(error.message + String(error.cause ?? '')).includes(
      'contacts_email_key'
    )
  )
}

/**
 * Validates a person save and works out what it changes. No writes
 * (except the shorthand's find-or-create company, which the sheet never
 * sends).
 */
export async function prepareContactSave(
  user: AppUser,
  input: ContactInput,
  existing: ExistingContact | null
): Promise<{ error: string } | { plan: ContactSavePlan }> {
  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid person data.' }
  }
  try {
    assertCrmAccess(user)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'CRM access required.',
    }
  }

  const { email, name, phone } = parsed.data
  const canManageAccess = roleCan(user.role, 'clients.manage')
  // Portal access is for people who manage clients: a save from anyone
  // else that names it is refused, never applied.
  if (
    !canManageAccess &&
    parsed.data.companies?.some(entry => entry.portalAccess !== undefined)
  ) {
    return { error: 'Only an admin can change portal access.' }
  }

  // The one-company shorthand (CLI, MCP, create-from-picker).
  let shorthandCompanyId: string | null = null
  try {
    shorthandCompanyId = await resolveShorthandCompany(
      user,
      parsed.data.companyId,
      parsed.data.companyName
    )
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Unable to save the company.',
    }
  }
  const desired: DesiredMembership[] | null = parsed.data.companies
    ? parsed.data.companies.map(entry => ({
        companyId: entry.companyId,
        title: entry.title,
      }))
    : null
  const shorthand = {
    shorthandCompanyId,
    shorthandTitle: parsed.data.jobTitle,
  }

  if (!existing) {
    const plan = planMembershipChanges([], desired, shorthand)
    const staffError = await staffCompanyError(user, plan)
    if (staffError) return { error: staffError }
    const linkedinUrl = parsed.data.linkedinUrl ?? null
    return {
      plan: {
        mode: 'create',
        contactId: randomUUID(),
        values: { email, name, phone: phone ?? null, linkedinUrl },
        existing: null,
        membership: plan,
        currentById: new Map(),
        changedFields: [],
        before: {},
        after: {},
      },
    }
  }

  // Someone who can sign in is edited by admins only: their email is their
  // login and their companies decide what they can see.
  if (existing.userId && !isAdminRole(user.role)) {
    return { error: PERSON_WITH_SIGN_IN_ADMIN_ONLY }
  }

  const next = {
    email,
    name,
    phone: phone ?? null,
    linkedinUrl:
      parsed.data.linkedinUrl === undefined
        ? existing.linkedinUrl
        : parsed.data.linkedinUrl,
  }
  const labels: Record<keyof typeof next, string> = {
    email: 'email',
    name: 'name',
    phone: 'phone',
    linkedinUrl: 'LinkedIn',
  }
  const changedFields: string[] = []
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const key of Object.keys(next) as (keyof typeof next)[]) {
    if (existing[key] !== next[key]) {
      changedFields.push(labels[key])
      before[key] = existing[key]
      after[key] = next[key]
    }
  }

  const current = await loadCurrentMemberships(existing.id)
  const currentById = new Map(current.map(m => [m.companyId, m]))
  const plan = planMembershipChanges(current, desired, shorthand)

  // Sales builds the directory: joining or leaving any company, clients
  // included, and titles there. A client's primary contact is its invoice
  // recipient, so leaving it (which ends being primary) or changing their
  // email is for people who manage clients, as on the company sheet.
  const primaryAtClient = current.filter(m => m.isPrimary && m.clientCompanyId)
  if (
    !canManageAccess &&
    plan.leave.some(companyId =>
      primaryAtClient.some(m => m.companyId === companyId)
    )
  ) {
    return { error: CLIENT_PRIMARY_ADMIN_ONLY }
  }
  if (
    !canManageAccess &&
    existing.email !== email &&
    primaryAtClient.length > 0
  ) {
    return {
      error:
        'This person is a client’s primary contact, so only an admin can change their email.',
    }
  }
  // The staff company's people are admin-only (staff sign in through it).
  const staffError = await staffCompanyError(user, plan)
  if (staffError) return { error: staffError }
  // Leaving a company whose client they can see ends their portal access,
  // so that's admin-only (portal access needs a sign-in, which is too).
  if (
    !canManageAccess &&
    plan.leave.some(companyId => currentById.get(companyId)?.portalAccess)
  ) {
    return {
      error:
        'Only an admin can remove someone with portal access from a company.',
    }
  }

  if (plan.join.length || plan.leave.length) changedFields.push('companies')
  if (plan.titles.length) changedFields.push('title')

  return {
    plan: {
      mode: 'update',
      contactId: existing.id,
      values: next,
      existing,
      membership: plan,
      currentById,
      changedFields,
      before,
      after,
    },
  }
}

/** Writes a prepared person save inside the caller's transaction. */
export async function writeContactSave(
  tx: DbTx,
  user: AppUser,
  plan: ContactSavePlan
): Promise<void> {
  const id = plan.contactId
  if (plan.mode === 'create') {
    await tx.insert(contacts).values({
      id,
      ...plan.values,
      createdBy: user.id,
    })
  } else {
    // Always, even when only their companies, photo or sign-in change: the
    // new `updated_at` is what makes a sheet loaded before this save refuse
    // to overwrite it (savePersonSheet).
    await tx
      .update(contacts)
      .set({ ...plan.values, updatedAt: new Date().toISOString() })
      .where(eq(contacts.id, id))
  }

  for (const companyId of plan.membership.leave) {
    await leaveCompany(tx, id, companyId)
  }
  for (const join of plan.membership.join) {
    const company = await getLinkableCompany(join.companyId, tx)
    if (!company) throw new Error('That company no longer exists.')
    await joinCompany(tx, id, join.companyId, { title: join.title })
  }
  for (const change of plan.membership.titles) {
    await setMembershipTitle(tx, id, change.companyId, change.title)
  }
}

/** The activity rows for a committed person save. */
export async function logContactSave(
  user: AppUser,
  plan: ContactSavePlan
): Promise<void> {
  const { contactId: id, values, membership, currentById } = plan
  if (plan.mode === 'create') {
    const event = contactCreatedEvent({
      email: values.email,
      name: values.name,
    })
    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'CONTACT',
      targetId: id,
      metadata: event.metadata,
    })
    return
  }

  // Access trail on the client, as on the company sheet.
  const accessChanges: ContactClientLinkChange[] = []
  for (const companyId of membership.leave) {
    const left = currentById.get(companyId)
    if (left?.portalAccess && left.clientCompanyId) {
      accessChanges.push({
        contactId: id,
        clientCompanyId: left.clientCompanyId,
        action: 'unlinked',
      })
    }
  }
  await logContactClientLinkChanges(user, accessChanges)

  if (plan.changedFields.length === 0) return
  const event = contactUpdatedEvent({
    email: values.email,
    name: values.name,
    changedFields: plan.changedFields,
    details: {
      before: {
        ...plan.before,
        ...(membership.leave.length
          ? {
              leftCompanies: membership.leave.map(
                companyId => currentById.get(companyId)?.companyName
              ),
            }
          : {}),
      },
      after: {
        ...plan.after,
        ...(membership.join.length
          ? { joinedCompanies: membership.join.map(join => join.companyId) }
          : {}),
      },
    },
  })
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'CONTACT',
    targetId: id,
    metadata: event.metadata,
  })
}

/**
 * A person save on its own (no photo or sign-in): prepare, one
 * transaction, then the activity rows.
 */
export async function saveContactMutation(
  context: ContactMutationContext,
  input: ContactInput
): Promise<ContactMutationResult> {
  const isUpdate = Boolean(input.id)
  return trackSettingsServerInteraction(
    {
      entity: 'contact',
      mode: isUpdate ? 'edit' : 'create',
      targetId: input.id ?? undefined,
    },
    async () => {
      const { user } = context
      const existing = input.id ? await loadExistingContact(input.id) : null
      if (isUpdate && !existing) {
        return buildMutationResult({ error: 'Person not found.' })
      }
      const prepared = await prepareContactSave(user, input, existing)
      if ('error' in prepared) {
        return buildMutationResult({ error: prepared.error })
      }
      const { plan } = prepared
      try {
        await db.transaction(tx => writeContactSave(tx, user, plan))
      } catch (error) {
        console.error('Failed to save contact', error)
        return buildMutationResult({
          error: isEmailConflict(error)
            ? 'A person with this email already exists.'
            : isUpdate
              ? 'Unable to update person.'
              : 'Unable to create person.',
        })
      }
      await logContactSave(user, plan)
      return buildMutationResult(isUpdate ? {} : { id: plan.contactId })
    }
  )
}

/**
 * What a save changes about the person's companies. With `desired` (the
 * sheet's full list) companies missing from it are left and new ones
 * joined; titles follow it. Without it, only the one-company
 * shorthand applies: join that company (title there if given).
 */
function planMembershipChanges(
  current: CurrentMembership[],
  desired: DesiredMembership[] | null,
  shorthand: {
    shorthandCompanyId: string | null
    shorthandTitle: string | null | undefined
  }
) {
  const currentById = new Map(current.map(m => [m.companyId, m]))
  const join: { companyId: string; title: string | null }[] = []
  const leave: string[] = []
  const titles: { companyId: string; title: string | null }[] = []

  const wanted: DesiredMembership[] = desired ? [...desired] : []
  if (
    shorthand.shorthandCompanyId &&
    !wanted.some(entry => entry.companyId === shorthand.shorthandCompanyId)
  ) {
    wanted.push({
      companyId: shorthand.shorthandCompanyId,
      title: shorthand.shorthandTitle,
    })
  }

  const seen = new Set<string>()
  for (const entry of wanted) {
    if (seen.has(entry.companyId)) continue
    seen.add(entry.companyId)
    const existing = currentById.get(entry.companyId)
    if (!existing) {
      join.push({ companyId: entry.companyId, title: entry.title ?? null })
    } else if (entry.title !== undefined && entry.title !== existing.title) {
      titles.push({ companyId: entry.companyId, title: entry.title })
    }
  }
  if (desired) {
    for (const membership of current) {
      if (!seen.has(membership.companyId)) leave.push(membership.companyId)
    }
  }
  return { join, leave, titles }
}

/**
 * Refusal for a non-admin joining someone to, removing them from, or
 * retitling them at the staff company: staff sign in through it.
 */
async function staffCompanyError(
  user: AppUser,
  plan: MembershipPlan
): Promise<string | null> {
  if (isAdminRole(user.role)) return null
  const companyIds = [
    ...plan.join.map(join => join.companyId),
    ...plan.leave,
    ...plan.titles.map(change => change.companyId),
  ]
  if (!companyIds.length) return null
  const [staff] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(and(inArray(companies.id, companyIds), eq(companies.isStaff, true)))
    .limit(1)
  return staff ? `Only an admin can change the people at ${staff.name}.` : null
}
