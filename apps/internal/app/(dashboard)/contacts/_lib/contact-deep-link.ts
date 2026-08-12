import 'server-only'

import type { AppUser } from '@/lib/auth/session'
import { getContactDeepLinkRowById } from '@/lib/queries/contacts'
import type { ContactSheetInput } from '@/lib/settings/contacts/use-contact-sheet-state'
import { contactSheetHref } from '@/lib/sheets/hrefs'
import {
  resolveSheetDeepLink,
  type SheetDeepLink,
} from '@/lib/sheets/resolve-deep-link'

const contactArchiveSheetHref = (id: string) =>
  `/contacts/archive?contact=${id}`

type ContactDeepLinkRecord = ContactSheetInput & { deletedAt: string | null }

/**
 * Resolves the `?contact=<id>` share link for a contacts tab. Both tabs are
 * server-paginated, so the linked row is fetched by id regardless of which
 * page it lands on; a link opened on the wrong tab redirects to the matching
 * one so it keeps working after the contact is archived or restored.
 */
export function resolveContactDeepLink(
  user: AppUser,
  idParam: string | undefined,
  tab: 'active' | 'archive'
): Promise<SheetDeepLink<ContactDeepLinkRecord>> {
  return resolveSheetDeepLink({
    idParam,
    fetchById: id => getContactDeepLinkRowById(user, id),
    tab,
    isArchived: contact => contact.deletedAt !== null,
    activeHref: contactSheetHref,
    archiveHref: contactArchiveSheetHref,
  })
}
