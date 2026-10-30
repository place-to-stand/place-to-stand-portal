import 'server-only'

import { eq, inArray, sql } from 'drizzle-orm'

import {
  billingEndsOnSql,
  billingOpenSql,
  wasClientCompany,
} from '@pts/db/client-state'

import {
  clientBillingRestartedEvent,
  clientBillingStoppedEvent,
  clientCreatedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { roleCan } from '@/lib/auth/capabilities'
import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { startClientBillingInTx } from '@/lib/companies/billing/actions/create-client'
import { stopClientBillingInTx } from '@/lib/companies/billing/actions/soft-delete-client'
import {
  applyClientUpdateInTx,
  ClosedMonthError,
  logClientUpdate,
  planClientUpdate,
  type ClientUpdatePlan,
} from '@/lib/companies/billing/actions/update-client'
import {
  assertClientPartnerUserRoles,
  generateUniqueClientSlug,
  toClientSlug,
} from '@/lib/companies/billing/client-service'
import { closerSplitError } from '@/lib/companies/billing/closers'
import {
  BillingPeriodError,
  restartBilling,
  type BillingEffective,
} from '@/lib/companies/billing/periods'
import {
  afterSignInsCommitted,
  discardPreparedSignIns,
  prepareClientSignIns,
  SignInConflictError,
  writeClientSignIns,
  type PreparedSignIn,
  type SignInRequest,
} from '@/lib/companies/portal-sign-ins'
import {
  companyBillingFieldsSchema,
  saveCompanySheetSchema,
  type SaveCompanySheetInput,
} from '@/lib/companies/sheet-save-schema'
import type { CompanyActionResult } from '@/lib/companies/types'
import { isMonthClosed } from '@/lib/data/reports/close'
import { db } from '@/lib/db'
import { companies, contacts } from '@/lib/db/schema'
import { currentMonthStartUtc } from '@/lib/queries/clients/billing-terms'
import {
  applyPortalAccessInTx,
  PortalAccessRefusal,
} from '@/lib/queries/clients/settings/client-contacts'
import {
  companySaveErrorMessage,
  logCompanyWrite,
  planCompanyWrite,
  writeCompany,
  type CompanyWritePlan,
} from '@/lib/queries/companies'
import { logContactClientLinkChanges } from '@/lib/queries/contacts/settings/contact-client-link-activity'
import { listCompanyMembers } from '@/lib/queries/memberships'

type BillingFields = ReturnType<typeof companyBillingFieldsSchema.parse>

/** The billing half of a save, checked before the transaction. */
type BillingPlan =
  | { kind: 'none' }
  | {
      kind: 'start'
      effective: BillingEffective
      fields: BillingFields
      slug: string
      /** The slug was made up here, so a clash can retry with another. */
      slugGenerated: boolean
      slugBase: string
    }
  | { kind: 'update'; update: ClientUpdatePlan }
  | { kind: 'stop'; effective: BillingEffective }
  | {
      kind: 'restart'
      effective: BillingEffective
      update: ClientUpdatePlan | null
      /** Cancels a stop that hasn't taken effect: changes no month. */
      cancelsStop: boolean
    }

type PortalPlan = { grant: string[]; revoke: string[] }

const SLUG_RETRY_LIMIT = 3

/**
 * The company sheet's Save: one server action, one transaction. The company
 * and its people, its billing (start, edit, stop or restart) and who has
 * portal access commit together or not at all. Supabase Auth can't join
 * the transaction, so sign-ins for people given portal access are made just
 * before it and deleted again if it fails; invites and activity rows go out
 * after the commit.
 */
export async function saveCompanySheet(
  actor: AppUser,
  input: SaveCompanySheetInput
): Promise<CompanyActionResult> {
  assertCrmAccess(actor)

  const parsed = saveCompanySheetSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid company details.',
    }
  }
  const values = parsed.data

  const canManageClients = roleCan(actor.role, 'clients.manage')
  if (
    !canManageClients &&
    (values.billing.kind !== 'none' ||
      values.portalAccessContactIds !== undefined)
  ) {
    return {
      ok: false,
      error: 'Only an admin can change billing or portal access.',
    }
  }

  const planned = await planCompanyWrite(actor, values)
  if (!planned.ok) return planned
  const { plan } = planned

  const billing = await planBilling(actor, plan, values.billing)
  if ('error' in billing) return { ok: false, error: billing.error }

  const portal = await planPortalAccess(
    plan,
    billing.plan,
    billing.billingOpen,
    values.portalAccessContactIds
  )
  if ('error' in portal) return { ok: false, error: portal.error }

  let signIns: PreparedSignIn[] = []
  if (portal.signIns.length) {
    const prepared = await prepareClientSignIns(portal.signIns)
    if (!prepared.ok) return prepared
    signIns = prepared.signIns
  }

  let billingPlan = billing.plan
  let committed: { companyId: string }
  let attempt = 0
  for (;;) {
    try {
      committed = await db.transaction(async tx => {
        if (billingPlan.kind !== 'none') {
          // One billing change per company at a time: start, stop and
          // restart for the same company queue here.
          if (plan.existing) {
            await tx.execute(
              sql`select id from companies where id = ${plan.existing.id} for update`
            )
          }
          // Re-checked inside the transaction: the month could be closed
          // between planning and commit.
          const changesThisMonth =
            (billingPlan.kind === 'start' ||
              billingPlan.kind === 'stop' ||
              (billingPlan.kind === 'restart' && !billingPlan.cancelsStop)) &&
            billingPlan.effective === 'current_month'
          if (
            changesThisMonth &&
            (await isMonthClosed(currentMonthStartUtc()))
          ) {
            throw new ClosedMonthError(currentMonthStartUtc())
          }
        }
        const companyId = await writeCompany(tx, actor, plan)

        switch (billingPlan.kind) {
          case 'start':
            await startClientBillingInTx(tx, {
              companyId,
              slug: billingPlan.slug,
              state: billingPlan.fields.state,
              billingType: billingPlan.fields.billingType,
              originationUserId: billingPlan.fields.originationUserId,
              originationContactId: billingPlan.fields.originationContactId,
              closers: billingPlan.fields.closers,
              effective: billingPlan.effective,
              actorId: actor.id,
            })
            break
          case 'update':
            await applyClientUpdateInTx(tx, billingPlan.update, actor.id)
            break
          case 'stop':
            // Portal switches stay as they are: access ends with billing.
            await stopClientBillingInTx(tx, {
              companyId,
              effective: billingPlan.effective,
            })
            break
          case 'restart':
            await restartBilling(tx, {
              companyId,
              effective: billingPlan.effective,
              actorId: actor.id,
            })
            if (billingPlan.update) {
              await applyClientUpdateInTx(tx, billingPlan.update, actor.id)
            }
            break
        }

        // Sign-ins first: portal access needs one.
        await writeClientSignIns(tx, actor, signIns)
        if (portal.changes) {
          await applyPortalAccessInTx(tx, companyId, portal.changes)
        }
        return { companyId }
      })
      break
    } catch (error) {
      // A made-up slug another company took meanwhile: try the next one.
      if (
        billingPlan.kind === 'start' &&
        billingPlan.slugGenerated &&
        isSlugClash(error) &&
        attempt < SLUG_RETRY_LIMIT
      ) {
        attempt += 1
        try {
          billingPlan = {
            ...billingPlan,
            slug: await generateUniqueClientSlug(billingPlan.slugBase),
          }
          continue
        } catch (slugError) {
          // Fall through: undo the prepared sign-ins and report the failure.
          error = slugError
        }
      }
      await discardPreparedSignIns(signIns)
      const message = saveErrorMessage(error)
      if (!message) console.error('Failed to save the company sheet', error)
      return { ok: false, error: message ?? 'Unable to save the company.' }
    }
  }

  // Committed: a logging or email failure must not report the save as failed.
  try {
    await logAfterCommit(actor, plan, billingPlan, portal, signIns, committed)
  } catch (error) {
    console.error('Failed to log a company sheet save', error)
  }

  return { ok: true, id: committed.companyId }
}

async function planBilling(
  actor: AppUser,
  plan: CompanyWritePlan,
  intent: ReturnType<typeof saveCompanySheetSchema.parse>['billing']
): Promise<{ plan: BillingPlan; billingOpen: boolean } | { error: string }> {
  const companyId = plan.existing?.id ?? null
  const [current] = companyId
    ? await db
        .select({
          wasClient: sql<boolean>`${wasClientCompany()}`,
          billingOpen: sql<boolean>`${billingOpenSql()}`,
          endsOn: billingEndsOnSql,
          slug: companies.slug,
        })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1)
    : []
  const wasClient = Boolean(current?.wasClient)
  const billingOpen = Boolean(current?.billingOpen)
  const stopping = billingOpen && Boolean(current?.endsOn)

  const checkFields = async (fields: BillingFields) => {
    if (fields.originationUserId && fields.originationContactId) {
      return 'Origination is one admin or one person, not both.'
    }
    const splitError = closerSplitError(fields.closers)
    if (splitError) return splitError
    const roleError = await assertClientPartnerUserRoles({
      originationUserId: fields.originationUserId,
      closers: fields.closers,
    })
    return roleError?.error ?? null
  }

  const planUpdate = async (
    fields: BillingFields
  ): Promise<{ update: ClientUpdatePlan } | { error: string }> => {
    const result = await planClientUpdate(actor, {
      id: companyId!,
      name: plan.next.name,
      providedSlug: fields.slug ?? current?.slug ?? null,
      billingType: fields.billingType,
      billingEffective: fields.billingEffective,
      commissionEffective: fields.commissionEffective,
      state: fields.state,
      originationUserId: fields.originationUserId,
      originationContactId: fields.originationContactId,
      closers: fields.closers,
      notes: null,
    })
    if ('error' in result) return result
    // Notes are the company's, saved (and logged) with the company.
    result.plan.notes = result.plan.existingClient.notes
    return { update: result.plan }
  }

  // Starting, stopping or restarting this month changes this month's close.
  const guardThisMonth = async (effective: BillingEffective) => {
    if (effective !== 'current_month') return null
    const month = currentMonthStartUtc()
    return (await isMonthClosed(month))
      ? new ClosedMonthError(month).message
      : null
  }

  switch (intent.kind) {
    case 'none':
      return { plan: { kind: 'none' }, billingOpen }
    case 'start': {
      if (wasClient) {
        return {
          error: 'That company was a client: restart its billing instead.',
        }
      }
      const fieldError =
        (await checkFields(intent.fields)) ??
        (await guardThisMonth(intent.effective))
      if (fieldError) return { error: fieldError }
      const slugBase = toClientSlug(intent.fields.slug ?? plan.next.name)
      // Keep a slug it already has (its project URLs use it).
      const kept = current?.slug ?? null
      return {
        plan: {
          kind: 'start',
          effective: intent.effective,
          fields: intent.fields,
          slug: kept ?? (await generateUniqueClientSlug(slugBase)),
          slugGenerated: !kept,
          slugBase,
        },
        billingOpen,
      }
    }
    case 'update': {
      if (!billingOpen) {
        return { error: 'This company isn’t billed now. Reload and try again.' }
      }
      const fieldError = await checkFields(intent.fields)
      if (fieldError) return { error: fieldError }
      const result = await planUpdate(intent.fields)
      if ('error' in result) return result
      return { plan: { kind: 'update', update: result.update }, billingOpen }
    }
    case 'stop': {
      if (!billingOpen) return { error: 'Billing has already stopped.' }
      const guard = await guardThisMonth(intent.effective)
      if (guard) return { error: guard }
      return {
        plan: { kind: 'stop', effective: intent.effective },
        billingOpen,
      }
    }
    case 'restart': {
      if (!wasClient) return { error: 'That company was never a client.' }
      if (billingOpen && !stopping) {
        return { error: 'That company is already a client.' }
      }
      // Cancelling a stop that hasn't taken effect changes no month.
      const guard = stopping ? null : await guardThisMonth(intent.effective)
      if (guard) return { error: guard }
      let update: ClientUpdatePlan | null = null
      if (intent.fields) {
        const fieldError = await checkFields(intent.fields)
        if (fieldError) return { error: fieldError }
        // Restarting after a gap: changed terms start with the restart's
        // first billed month (cancelling a stop keeps the months chosen).
        const fields = stopping
          ? intent.fields
          : {
              ...intent.fields,
              billingEffective: intent.effective,
              commissionEffective: intent.effective,
            }
        const result = await planUpdate(fields)
        if ('error' in result) return result
        update = result.update
      }
      return {
        plan: {
          kind: 'restart',
          effective: intent.effective,
          update,
          cancelsStop: stopping,
        },
        billingOpen,
      }
    }
  }
}

/**
 * Who gains and loses portal access with this save, and who needs a sign-in
 * for it. Everyone listed must be at the company once the save's people
 * changes land, and the company must be billed.
 */
async function planPortalAccess(
  plan: CompanyWritePlan,
  billing: BillingPlan,
  billingOpenBefore: boolean,
  wantedIds: string[] | undefined
): Promise<
  { changes: PortalPlan | null; signIns: SignInRequest[] } | { error: string }
> {
  // A stop leaves the switches as they are (access ends with billing).
  if (wantedIds === undefined || billing.kind === 'stop') {
    return { changes: null, signIns: [] }
  }
  const billedAfter =
    billing.kind === 'start' || billing.kind === 'restart' || billingOpenBefore
  const wanted = new Set(wantedIds)

  const leaving = new Set(
    plan.moves.filter(move => !move.joins).map(move => move.contactId)
  )
  const joiningIds = plan.moves
    .filter(move => move.joins)
    .map(move => move.contactId)
  const [currentMembers, joining] = await Promise.all([
    plan.existing ? listCompanyMembers(plan.existing.id) : [],
    joiningIds.length
      ? db
          .select({
            contactId: contacts.id,
            name: contacts.name,
            email: contacts.email,
            userId: contacts.userId,
          })
          .from(contacts)
          .where(inArray(contacts.id, joiningIds))
      : [],
  ])
  const members = [
    ...currentMembers
      .filter(member => !leaving.has(member.contactId))
      .map(member => ({ ...member, portalAccess: member.portalAccess })),
    ...joining.map(person => ({ ...person, portalAccess: false })),
  ]
  const memberIds = new Set(members.map(member => member.contactId))

  const outsiders = [...wanted].filter(id => !memberIds.has(id))
  if (outsiders.length) {
    return {
      error:
        'Someone given portal access isn’t at this company. Add them on People first.',
    }
  }

  const grant = members.filter(
    member => wanted.has(member.contactId) && !member.portalAccess
  )
  // A former client's switches can go off (so a restart doesn't give that
  // access back), but only a billed company gives anyone access.
  if (!billedAfter && grant.length) {
    return {
      error: 'Bill this company before giving its people portal access.',
    }
  }
  const revoke = members.filter(
    member => !wanted.has(member.contactId) && member.portalAccess
  )
  return {
    changes: {
      grant: grant.map(member => member.contactId),
      revoke: revoke.map(member => member.contactId),
    },
    signIns: grant
      .filter(member => !member.userId)
      .map(member => ({
        contactId: member.contactId,
        name: member.name,
        email: member.email,
      })),
  }
}

async function logAfterCommit(
  actor: AppUser,
  plan: CompanyWritePlan,
  billing: BillingPlan,
  portal: { changes: PortalPlan | null },
  signIns: PreparedSignIn[],
  committed: { companyId: string }
) {
  const { companyId } = committed
  await logCompanyWrite(actor, plan, companyId)

  const clientActivity = (event: ReturnType<typeof clientCreatedEvent>) =>
    logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'COMPANY',
      targetId: companyId,
      targetCompanyId: companyId,
      metadata: event.metadata,
    })

  switch (billing.kind) {
    case 'start':
      await clientActivity(
        clientCreatedEvent({ name: plan.next.name, memberIds: [] })
      )
      break
    case 'update':
      await logClientUpdate(actor, billing.update)
      break
    case 'stop':
      await clientActivity(
        clientBillingStoppedEvent({
          name: plan.next.name,
          effective: billing.effective,
        })
      )
      break
    case 'restart':
      await clientActivity(
        clientBillingRestartedEvent({
          name: plan.next.name,
          effective: billing.effective,
          cancelsStop: billing.cancelsStop,
        })
      )
      if (billing.update) await logClientUpdate(actor, billing.update)
      break
  }

  await afterSignInsCommitted(actor, signIns, companyId)

  await logContactClientLinkChanges(actor, [
    ...(portal.changes?.grant ?? []).map(contactId => ({
      contactId,
      clientCompanyId: companyId,
      action: 'linked' as const,
    })),
    ...(portal.changes?.revoke ?? []).map(contactId => ({
      contactId,
      clientCompanyId: companyId,
      action: 'unlinked' as const,
    })),
  ])
}

function saveErrorMessage(error: unknown): string | null {
  if (
    error instanceof BillingPeriodError ||
    error instanceof ClosedMonthError ||
    error instanceof PortalAccessRefusal ||
    error instanceof SignInConflictError
  ) {
    return error.message
  }
  if (isSlugClash(error)) {
    return 'Another client already uses this slug.'
  }
  return companySaveErrorMessage(error)
}

function isSlugClash(error: unknown): boolean {
  const read = (value: unknown) =>
    value as { code?: string; constraint_name?: string; constraint?: string }
  for (const candidate of [error, (error as { cause?: unknown })?.cause]) {
    const e = read(candidate)
    if (
      e?.code === '23505' &&
      (e.constraint_name ?? e.constraint) === 'companies_slug_key'
    ) {
      return true
    }
  }
  return false
}
