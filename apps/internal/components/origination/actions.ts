'use server'

import { assertAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import {
  listAllActiveContacts,
  listAllAdminUsers,
} from '@/lib/queries/clients/settings/client-contacts'

import type { OriginationContactOption, PartnerUserOption } from './types'

export type OriginationOptions = {
  contacts: OriginationContactOption[]
  users: PartnerUserOption[]
}

/**
 * Options for the shared origination picker, self-fetched by whichever sheet is
 * rendering it (PRD 005 C12).
 *
 * The lead sheet has no contacts on any path — `SheetInitPayloads['lead']` is
 * `{lead, assignees, senderName}` — so the picker has no source without this.
 * The alternative, widening the sheet-init payload, would add a full contacts
 * list to a route that serves EVERY dashboard sheet, most of which never need
 * it. The client sheet already self-fetches for the same reason.
 *
 * Produces both option shapes directly, so neither call site maps between its
 * own local option type and the picker's (C13).
 */
export async function loadOriginationOptions(): Promise<OriginationOptions> {
  const user = await requireUser()
  assertAdmin(user)

  const [contacts, users] = await Promise.all([
    listAllActiveContacts(user),
    listAllAdminUsers(user),
  ])

  return {
    contacts: contacts.map(contact => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
    })),
    users,
  }
}
