import 'server-only'

import { and, eq } from 'drizzle-orm'

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
    throw new ForbiddenError('You do not have access to this client')
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
    throw new ForbiddenError('You do not have access to this client')
  }
}

// Client scoping lives in `@/lib/auth/view-as` (`resolvePortalScope`), which is
// the single place that answers "which clients may this request touch?".
// Do not add a second scoping path here.
