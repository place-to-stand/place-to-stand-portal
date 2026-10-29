import { and, eq, inArray, isNull } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import {
  contactCreatedEvent,
  contactUpdatedEvent,
} from '@/lib/activity/events/contacts'
import { roleCan } from '@/lib/auth/capabilities'
import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import {
  logContactClientLinkChanges,
  type ContactClientLinkChange,
} from '@/lib/queries/contacts/settings/contact-client-link-activity'
import { db } from '@/lib/db'
import { clients, companies, contacts, memberships } from '@/lib/db/schema'
import {
  findOrCreateCompanyByName,
  getLinkableCompany,
} from '@/lib/queries/companies'
import {
  joinCompany,
  leaveCompany,
  setMembershipTitle,
  setPortalAccess,
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
  portalAccess: boolean | undefined
}

type CurrentMembership = {
  companyId: string
  companyName: string
  title: string | null
  portalAccess: boolean
  clientId: string | null
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
      portalAccess: memberships.portalAccess,
      clientId: clients.id,
    })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .leftJoin(
      clients,
      and(eq(clients.companyId, companies.id), isNull(clients.deletedAt))
    )
    .where(
      and(eq(memberships.contactId, contactId), isNull(memberships.endedAt))
    )
}

function isEmailConflict(error: unknown) {
  return (
    error instanceof Error &&
    String(error.message + String(error.cause ?? '')).includes(
      'contacts_email_key'
    )
  )
}

export async function saveContactMutation(
  context: ContactMutationContext,
  input: ContactInput
): Promise<ContactMutationResult> {
  const parsed = contactSchema.safeParse(input)

  if (!parsed.success) {
    return buildMutationResult({
      error: parsed.error.issues[0]?.message ?? 'Invalid contact data.',
    })
  }

  const isUpdate = Boolean(parsed.data.id)

  return trackSettingsServerInteraction(
    {
      entity: 'contact',
      mode: isUpdate ? 'edit' : 'create',
      targetId: parsed.data.id,
    },
    async () => {
      const { user } = context
      try {
        assertCrmAccess(user)
      } catch (error) {
        if (error instanceof Error) {
          return buildMutationResult({ error: error.message })
        }
        return buildMutationResult({ error: 'CRM access required.' })
      }

      const { id, email, name, phone } = parsed.data
      const canManageAccess = roleCan(user.role, 'clients.manage')

      // The one-company shorthand (CLI, MCP, create-from-picker).
      let shorthandCompanyId: string | null = null
      try {
        shorthandCompanyId = await resolveShorthandCompany(
          user,
          parsed.data.companyId,
          parsed.data.companyName
        )
      } catch (error) {
        return buildMutationResult({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to save the company.',
        })
      }
      const desired: DesiredMembership[] | null = parsed.data.companies
        ? parsed.data.companies.map(entry => ({
            companyId: entry.companyId,
            title: entry.title,
            portalAccess: entry.portalAccess,
          }))
        : null

      if (isUpdate && id) {
        const [existing] = await db
          .select({
            id: contacts.id,
            email: contacts.email,
            name: contacts.name,
            phone: contacts.phone,
            linkedinUrl: contacts.linkedinUrl,
          })
          .from(contacts)
          .where(eq(contacts.id, id))
          .limit(1)

        if (!existing) {
          return buildMutationResult({ error: 'Contact not found.' })
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

        const current = await loadCurrentMemberships(id)
        const currentById = new Map(current.map(m => [m.companyId, m]))
        const plan = planMembershipChanges(current, desired, {
          shorthandCompanyId,
          shorthandTitle: parsed.data.jobTitle,
        })

        // Leaving a client's company drops being its primary contact (its
        // invoice recipient) and portal access, so it's admin-only, as on
        // the company sheet. Joining one grants nothing by itself.
        if (
          !canManageAccess &&
          (await clientIdsByCompany(plan.leave)).size > 0
        ) {
          return buildMutationResult({
            error:
              'That company is a client, so only an admin can remove someone from it.',
          })
        }
        // Portal access is admin-only: switching it, or leaving a company
        // whose client they can see.
        if (!canManageAccess) {
          const touchesAccess =
            plan.leave.some(
              companyId => currentById.get(companyId)?.portalAccess
            ) ||
            plan.access.some(
              change =>
                (currentById.get(change.companyId)?.portalAccess ?? false) !==
                change.portalAccess
            )
          if (touchesAccess) {
            return buildMutationResult({
              error:
                'Only an admin can change portal access, or remove someone with portal access from a company.',
            })
          }
        }

        if (plan.join.length || plan.leave.length)
          changedFields.push('companies')
        if (plan.titles.length) changedFields.push('title')

        const accessChanges: ContactClientLinkChange[] = []
        try {
          await db.transaction(async tx => {
            await tx
              .update(contacts)
              .set({ ...next, updatedAt: new Date().toISOString() })
              .where(eq(contacts.id, id))

            for (const companyId of plan.leave) {
              await leaveCompany(tx, id, companyId)
            }
            for (const join of plan.join) {
              const company = await getLinkableCompany(join.companyId, tx)
              if (!company) throw new Error('That company no longer exists.')
              await joinCompany(tx, id, join.companyId, { title: join.title })
            }
            for (const change of plan.titles) {
              await setMembershipTitle(tx, id, change.companyId, change.title)
            }
            for (const change of plan.access) {
              await setPortalAccess(
                tx,
                id,
                change.companyId,
                change.portalAccess
              )
            }
          })
        } catch (error) {
          console.error('Failed to update contact', error)
          if (isEmailConflict(error)) {
            return buildMutationResult({
              error: 'A contact with this email already exists.',
            })
          }
          return buildMutationResult({ error: 'Unable to update contact.' })
        }

        // Access trail on the client, as on the client sheet.
        for (const companyId of plan.leave) {
          const left = currentById.get(companyId)
          if (left?.portalAccess && left.clientId) {
            accessChanges.push({
              contactId: id,
              clientId: left.clientId,
              action: 'unlinked',
            })
          }
        }
        const clientIds = await clientIdsByCompany(
          plan.access.map(change => change.companyId)
        )
        for (const change of plan.access) {
          const clientId = clientIds.get(change.companyId)
          if (!clientId) continue
          const was = currentById.get(change.companyId)?.portalAccess ?? false
          if (was !== change.portalAccess) {
            accessChanges.push({
              contactId: id,
              clientId,
              action: change.portalAccess ? 'linked' : 'unlinked',
            })
          }
        }
        await logContactClientLinkChanges(user, accessChanges)

        if (changedFields.length > 0) {
          const event = contactUpdatedEvent({
            email,
            name,
            changedFields,
            details: {
              before: {
                ...before,
                ...(plan.leave.length
                  ? {
                      leftCompanies: plan.leave.map(
                        companyId => currentById.get(companyId)?.companyName
                      ),
                    }
                  : {}),
              },
              after: {
                ...after,
                ...(plan.join.length
                  ? { joinedCompanies: plan.join.map(join => join.companyId) }
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

        return buildMutationResult({})
      }

      // Create.
      const plan = planMembershipChanges([], desired, {
        shorthandCompanyId,
        shorthandTitle: parsed.data.jobTitle,
      })
      if (!canManageAccess && plan.access.some(change => change.portalAccess)) {
        return buildMutationResult({
          error: 'Only an admin can give portal access.',
        })
      }

      let newContactId: string
      try {
        newContactId = await db.transaction(async tx => {
          const [created] = await tx
            .insert(contacts)
            .values({
              email,
              name,
              phone,
              linkedinUrl: parsed.data.linkedinUrl ?? null,
              createdBy: user.id,
            })
            .returning({ id: contacts.id })
          const contactId = created?.id ?? ''
          for (const join of plan.join) {
            const company = await getLinkableCompany(join.companyId, tx)
            if (!company) throw new Error('That company no longer exists.')
            await joinCompany(tx, contactId, join.companyId, {
              title: join.title,
            })
          }
          for (const change of plan.access) {
            await setPortalAccess(
              tx,
              contactId,
              change.companyId,
              change.portalAccess
            )
          }
          return contactId
        })
      } catch (error) {
        console.error('Failed to create contact', error)
        if (isEmailConflict(error)) {
          return buildMutationResult({
            error: 'A contact with this email already exists.',
          })
        }
        return buildMutationResult({ error: 'Unable to create contact.' })
      }

      const event = contactCreatedEvent({ email, name })
      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'CONTACT',
        targetId: newContactId,
        metadata: event.metadata,
      })

      return buildMutationResult({ id: newContactId })
    }
  )
}

/**
 * What a save changes about the person's companies. With `desired` (the
 * sheet's full list) companies missing from it are left and new ones
 * joined; titles and access follow it. Without it, only the one-company
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
  const access: { companyId: string; portalAccess: boolean }[] = []

  const wanted: DesiredMembership[] = desired ? [...desired] : []
  if (
    shorthand.shorthandCompanyId &&
    !wanted.some(entry => entry.companyId === shorthand.shorthandCompanyId)
  ) {
    wanted.push({
      companyId: shorthand.shorthandCompanyId,
      title: shorthand.shorthandTitle,
      portalAccess: undefined,
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
    if (
      entry.portalAccess !== undefined &&
      entry.portalAccess !== (existing?.portalAccess ?? false)
    ) {
      access.push({
        companyId: entry.companyId,
        portalAccess: entry.portalAccess,
      })
    }
  }
  if (desired) {
    for (const membership of current) {
      if (!seen.has(membership.companyId)) leave.push(membership.companyId)
    }
  }
  return { join, leave, titles, access }
}

async function clientIdsByCompany(companyIds: string[]) {
  const map = new Map<string, string>()
  if (!companyIds.length) return map
  const rows = await db
    .select({ id: clients.id, companyId: clients.companyId })
    .from(clients)
    .where(
      and(inArray(clients.companyId, companyIds), isNull(clients.deletedAt))
    )
  for (const row of rows) {
    if (row.companyId) map.set(row.companyId, row.id)
  }
  return map
}
