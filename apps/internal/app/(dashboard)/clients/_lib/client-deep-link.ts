import 'server-only'

import type { AppUser } from '@/lib/auth/session'
import { getClientByIdIncludingArchived } from '@/lib/queries/clients'
import type { ClientRow } from '@/lib/settings/clients/client-sheet-utils'
import { clientSheetHref } from '@/lib/sheets/hrefs'
import {
  resolveSheetDeepLink,
  type SheetDeepLink,
} from '@/lib/sheets/resolve-deep-link'

const clientArchiveSheetHref = (id: string) => `/clients/archive?client=${id}`

/**
 * Resolves the `?client=<id>` share link for a clients tab. The landing list
 * is filtered (`?q=`/`?billing=`) and the archive list is paginated, so the
 * linked row is fetched by id regardless of what the page renders; a link
 * opened on the wrong tab redirects to the matching one so it keeps working
 * after the client is archived or restored.
 */
export function resolveClientDeepLink(
  user: AppUser,
  idParam: string | undefined,
  tab: 'active' | 'archive'
): Promise<SheetDeepLink<ClientRow>> {
  return resolveSheetDeepLink({
    idParam,
    fetchById: async id => {
      const client = await getClientByIdIncludingArchived(user, id)

      if (!client) {
        return null
      }

      // The client sheet consumes the snake_case `DbClient` shape.
      return {
        id: client.id,
        name: client.name,
        slug: client.slug,
        notes: client.notes,
        website: client.website,
        state: client.state ?? null,
        origination_contact_id: client.originationContactId,
        origination_user_id: client.originationUserId,
        closer_user_id: client.closerUserId,
        billing_type: client.billingType,
        created_by: client.createdBy,
        created_at: client.createdAt,
        updated_at: client.updatedAt,
        deleted_at: client.deletedAt,
      }
    },
    tab,
    isArchived: client => client.deleted_at !== null,
    activeHref: clientSheetHref,
    archiveHref: clientArchiveSheetHref,
  })
}
