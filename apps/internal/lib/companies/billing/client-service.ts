import { inArray } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/lib/db'
import { contacts, users } from '@/lib/db/schema'
import {
  clientSlugExistsDrizzle,
  generateUniqueClientSlugDrizzle,
} from '@/lib/queries/clients'
import { CLIENT_BILLING_TYPE_VALUES } from '@/lib/companies/billing/billing-types'
import {
  closerSplitError,
  type CloserShare,
} from '@/lib/companies/billing/closers'

export const clientSchema = z
  .object({
    id: z.string().uuid().optional(),
    /**
     * Ignored when a company is given: the name is the company's name. Used
     * as the company name when a new client has no company.
     */
    name: z.string().default(''),
    /**
     * Deprecated and ignored: a company has one client, so clients no longer
     * need a label to tell them apart. Still accepted for old callers.
     */
    label: z.unknown().optional(),
    slug: z
      .string()
      .regex(
        /^[a-z0-9-]+$/,
        'Slugs can only contain lowercase letters, numbers, and dashes'
      )
      .or(z.literal(''))
      .nullish()
      .transform(value => (value ? value : null)),
    billingType: z.enum(CLIENT_BILLING_TYPE_VALUES).default('prepaid'),
    // Month boundary the report basis switches at when billingType changes on
    // an existing client. Ignored on create and when the type is unchanged.
    billingEffective: z
      .enum(['current_month', 'next_month'])
      .default('next_month'),
    // Month boundary the Monthly Close switches closer/origination at when
    // either changes on an existing client. Ignored on create and when the
    // assignment is unchanged.
    commissionEffective: z
      .enum(['current_month', 'next_month'])
      .default('next_month'),
    state: z
      .string()
      .max(2)
      .nullish()
      .transform(value => (value ? value : null)),
    // Deprecated: the company owns the website. A website sent here only
    // fills the client's company website when it has none.
    website: z
      .string()
      .url('Please enter a valid URL')
      .or(z.literal(''))
      .nullish()
      .transform(value => (value ? value : null))
      .optional(),
    notes: z
      .string()
      .nullish()
      .transform(value => (value ? value : null)),
    /**
     * The company this client is. On edit, omitted keeps the current one and
     * null unlinks it; a new client without one gets a company found or
     * created by its name.
     */
    companyId: z.string().uuid().nullable().optional(),
    originationContactId: z
      .string()
      .uuid()
      .nullish()
      .transform(value => value ?? null),
    originationUserId: z
      .string()
      .uuid()
      .nullish()
      .transform(value => value ?? null),
    closers: z
      .array(
        z.object({
          kind: z.enum(['user', 'contact']),
          id: z.string().uuid(),
          sharePercent: z.number(),
        })
      )
      .default([]),
  })
  .refine(
    data =>
      !(data.originationUserId !== null && data.originationContactId !== null),
    {
      message: 'Origination is one admin or one person, not both.',
      path: ['originationUserId'],
    }
  )
  // Closers are deliberately optional (PRD 007): with none the 20% share is
  // not paid out and the Monthly Close reports it under House (estimated).
  // With any, their shares must total exactly 100%.
  .superRefine((data, ctx) => {
    const error = closerSplitError(data.closers)
    if (error) {
      ctx.addIssue({ code: 'custom', message: error, path: ['closers'] })
    }
  })

/**
 * Verifies that any user IDs referenced by origination / closer fields
 * correspond to active staff users (ADMIN or SALES, so a salesperson can
 * take credit), and that closer contacts exist and are not archived. Staff
 * only: commissions must never accrue to CLIENT-role users.
 */
export async function assertClientPartnerUserRoles(params: {
  originationUserId: string | null
  closers: CloserShare[]
}): Promise<{ error: string } | null> {
  const contactError = await assertCloserContacts(
    params.closers.filter(c => c.kind === 'contact').map(c => c.id)
  )
  if (contactError) {
    return contactError
  }

  const ids = [
    params.originationUserId,
    ...params.closers.filter(c => c.kind === 'user').map(c => c.id),
  ].filter((id): id is string => typeof id === 'string' && id.length > 0)

  if (ids.length === 0) {
    return null
  }

  try {
    const rows = await db
      .select({ id: users.id, role: users.role, deletedAt: users.deletedAt })
      .from(users)
      .where(inArray(users.id, ids))

    const found = new Map(rows.map(row => [row.id, row]))

    for (const id of ids) {
      const user = found.get(id)
      if (!user) {
        return { error: 'Selected partner user no longer exists.' }
      }
      if (user.deletedAt !== null) {
        return { error: 'Selected partner user is archived.' }
      }
      if (user.role !== 'ADMIN' && user.role !== 'SALES') {
        return {
          error: 'Only PTS staff users can be set as origination or closer.',
        }
      }
    }
  } catch (error) {
    console.error('Failed to validate partner user roles', error)
    return { error: 'Unable to validate partner assignments.' }
  }

  return null
}

async function assertCloserContacts(
  contactIds: string[]
): Promise<{ error: string } | null> {
  if (contactIds.length === 0) return null

  try {
    const rows = await db
      .select({ id: contacts.id, deletedAt: contacts.deletedAt })
      .from(contacts)
      .where(inArray(contacts.id, contactIds))
    const found = new Map(rows.map(row => [row.id, row]))

    for (const id of contactIds) {
      const contact = found.get(id)
      if (!contact) {
        return { error: 'The selected closer no longer exists.' }
      }
      if (contact.deletedAt !== null) {
        return { error: 'The selected closer is archived.' }
      }
    }
  } catch (error) {
    console.error('Failed to validate closer contacts', error)
    return { error: 'Unable to validate partner assignments.' }
  }

  return null
}

const clientIdentifierSchema = {
  id: z.string().uuid(),
}

/** Stop or restart billing: this month (default) or next. */
const billingEffectiveSchema = {
  effective: z.enum(['current_month', 'next_month']).optional(),
}
export const deleteClientSchema = z.object({
  ...clientIdentifierSchema,
  ...billingEffectiveSchema,
})
export const restoreClientSchema = z.object({
  ...clientIdentifierSchema,
  ...billingEffectiveSchema,
})
export const destroyClientSchema = z.object(clientIdentifierSchema)

export type ClientInput = z.infer<typeof clientSchema>
export type DeleteClientInput = z.infer<typeof deleteClientSchema>
export type RestoreClientInput = z.infer<typeof restoreClientSchema>
export type DestroyClientInput = z.infer<typeof destroyClientSchema>

export type ClientActionResult = {
  error?: string
  clientId?: string // Returned on successful create
  slug?: string // Returned on successful create (create-from-picker needs it)
}

export type ClientSlugOptions = {
  excludeId?: string
}

const DEFAULT_SLUG = 'client'
const UNIQUE_RETRY_LIMIT = 3

export function toClientSlug(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || DEFAULT_SLUG
}

export async function clientSlugExists(
  slug: string,
  options: ClientSlugOptions = {}
): Promise<boolean> {
  return clientSlugExistsDrizzle(slug, options)
}

export async function generateUniqueClientSlug(base: string): Promise<string> {
  const normalizedBase = base || DEFAULT_SLUG
  let candidate = normalizedBase
  let suffix = 2
  let attempt = 0

  while (attempt < UNIQUE_RETRY_LIMIT) {
    const exists = await clientSlugExistsDrizzle(candidate)

    if (!exists) {
      return candidate
    }

    candidate = `${normalizedBase}-${suffix}`
    suffix += 1
    attempt += 1
  }

  return generateUniqueClientSlugDrizzle(normalizedBase, {
    initialCandidate: candidate,
    startSuffix: suffix,
  })
}
