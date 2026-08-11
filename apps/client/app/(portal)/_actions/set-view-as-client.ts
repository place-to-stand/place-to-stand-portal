'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients } from '@pts/db/schema'
import { requireClientUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { ForbiddenError } from '@/lib/errors/http'
import { VIEW_AS_COOKIE } from '@/lib/auth/view-as'

/**
 * Select which client an ADMIN previews the portal as.
 *
 * SECURITY: server actions are POST endpoints reachable by any authenticated
 * user who knows the action id, so the admin check here is the real guard —
 * hiding the picker in the UI is not.
 */
export async function setViewAsClient(clientId: string) {
  const user = await requireClientUser()

  if (!isAdmin(user)) {
    throw new ForbiddenError('Only admins can preview the client portal')
  }

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
    .limit(1)

  if (!client) {
    throw new ForbiddenError('Unknown client')
  }

  const cookieStore = await cookies()
  cookieStore.set(VIEW_AS_COOKIE, client.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  revalidatePath('/', 'layout')
}
