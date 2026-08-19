'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contacts } from '@pts/db/schema'
import { requireClientUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { ForbiddenError } from '@/lib/errors/http'
import { VIEW_AS_CONTACT_COOKIE, VIEW_AS_COOKIE } from '@/lib/auth/view-as'

/**
 * Select which contact an ADMIN previews the portal as.
 *
 * The portal will be scoped to all clients linked to that contact via
 * contact_clients.
 *
 * SECURITY: server actions are POST endpoints reachable by any authenticated
 * user who knows the action id, so the admin check here is the real guard —
 * hiding the picker in the UI is not.
 */
export async function setViewAsContact(contactId: string) {
  const user = await requireClientUser()

  if (!isAdmin(user)) {
    throw new ForbiddenError('Only admins can preview the client portal')
  }

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt)))
    .limit(1)

  if (!contact) {
    throw new ForbiddenError('Unknown contact')
  }

  const cookieStore = await cookies()

  // Set the contact preview cookie.
  cookieStore.set(VIEW_AS_CONTACT_COOKIE, contact.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  // Clear the old client-scoped cookie to avoid stale state.
  cookieStore.delete(VIEW_AS_COOKIE)

  revalidatePath('/', 'layout')
}
