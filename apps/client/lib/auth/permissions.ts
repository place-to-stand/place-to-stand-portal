import 'server-only'

import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { db } from '@/lib/db'
import { clientPortalAccess } from '@pts/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { ForbiddenError } from '@/lib/errors/http'

export function isAdmin(user: AppUser | null | undefined): boolean {
  return !!user && user.role === 'ADMIN'
}

/**
 * Verify user has access to a specific client.
 * In the client portal, users need portal access to it: a current,
 * portal-enabled membership at the client's company (`client_portal_access`).
 */
export async function ensureClientAccess(user: AppUser, companyId: string) {
  if (isAdmin(user)) {
    return
  }
  // Only a Client sign-in uses the portal (the view checks it too, 0116):
  // a Sales sign-in left with a portal flag gets nothing here.
  if (user.role !== 'CLIENT') {
    throw new ForbiddenError('You do not have access to this company')
  }

  const [access] = await db
    .select({ companyId: clientPortalAccess.companyId })
    .from(clientPortalAccess)
    .where(
      and(
        eq(clientPortalAccess.companyId, companyId),
        eq(clientPortalAccess.userId, user.id)
      )
    )
    .limit(1)

  if (!access) {
    throw new ForbiddenError('You do not have access to this company')
  }
}

/**
 * `ensureClientAccess` for API routes: the 400 or 403 response to return,
 * or null when the user may act for this company. Routes return it instead
 * of letting the error escape as a 500.
 */
export async function clientAccessDenied(
  user: AppUser,
  companyId: string
): Promise<NextResponse | null> {
  if (!z.uuid().safeParse(companyId).success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid companyId' },
      { status: 400 }
    )
  }
  try {
    await ensureClientAccess(user, companyId)
    return null
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 403 }
      )
    }
    throw error
  }
}

// Client scoping lives in `@/lib/auth/view-as` (`resolvePortalScope`), which is
// the single place that answers "which clients may this request touch?".
// Do not add a second scoping path here.
