import { type NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { cookies } from 'next/headers'

import { db } from '@/lib/db'
import { contacts } from '@pts/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { VIEW_AS_CONTACT_COOKIE, VIEW_AS_COOKIE } from '@/lib/auth/view-as'

/**
 * GET /api/admin/preview-contact?contactId=<uuid>
 *
 * Cross-app deep-link from the internal portal. Sets the view-as-contact cookie
 * then redirects to the portal home so the admin immediately sees that contact's
 * portal view.
 *
 * SECURITY: validates admin role from database; the contactId query param is
 * validated against live rows before the cookie is set.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  if (!isAdmin(user)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  const contactId = request.nextUrl.searchParams.get('contactId')

  if (!contactId) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt)))
    .limit(1)

  if (!contact) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const cookieStore = await cookies()

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  }

  // Set the contact preview cookie.
  cookieStore.set(VIEW_AS_CONTACT_COOKIE, contact.id, cookieOptions)

  // Clear the old client-scoped cookie to avoid stale state.
  cookieStore.delete(VIEW_AS_COOKIE)

  return NextResponse.redirect(new URL('/', request.url))
}
