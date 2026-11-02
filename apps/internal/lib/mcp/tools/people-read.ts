import 'server-only'

import type { AppUser } from '@/lib/auth/session'
import { serializeContactCompanies } from '@/lib/cli/serializers/contact'
import { canSeePortalAccess } from '@/lib/people/portal-visibility'
import {
  getContactSheetInputById,
  listContactClients,
} from '@/lib/queries/contacts/settings/contact-clients'
import { listContactMemberships } from '@/lib/queries/memberships'

/**
 * One person and their companies (title, primary), as get_contact and the
 * person write tools return it. Portal access, their sign-in and the clients
 * they can see are only for people who manage clients.
 */
export async function readPerson(user: AppUser, contactId: string) {
  const seesPortalAccess = canSeePortalAccess(user.role)
  const [contact, memberships] = await Promise.all([
    getContactSheetInputById(user, contactId),
    listContactMemberships([contactId]),
  ])
  const companies = serializeContactCompanies(
    memberships.get(contactId) ?? [],
    { seesPortalAccess }
  )
  if (!seesPortalAccess) {
    const { userId: _userId, ...rest } = contact
    void _userId
    return { contact: rest, companies }
  }
  return {
    contact,
    companies,
    clients: await listContactClients(user, contactId),
  }
}
