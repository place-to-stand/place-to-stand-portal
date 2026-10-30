import { inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contacts, users } from '@/lib/db/schema'
import {
  clientSlugExistsDrizzle,
  generateUniqueClientSlugDrizzle,
} from '@/lib/queries/clients'
import type { CloserShare } from '@/lib/companies/billing/closers'

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

type ClientSlugOptions = {
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
