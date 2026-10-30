import { roleCan, type Role } from '@/lib/auth/capabilities'
import type { ContactsSettingsListItem } from '@/lib/queries/contacts/settings/types'
import type { ContactMembership } from '@/lib/queries/memberships'

import { isoTimestamp } from './timestamp'

/** A company the contact belongs to (main company first). */
export type CliContactCompany = {
  companyId: string
  companyName: string
  title: string | null
  /** The company's primary contact. */
  isPrimary: boolean
  /**
   * Can see the company's client in the client portal (switch on and a
   * portal login). Left out for a viewer who can't manage clients.
   */
  portalAccess?: boolean
  /** The company's client, if it is one. */
  /** The company's id when it is a client (0111: a client is its company). */
  clientId: string | null
}

export type CliContact = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  /** Set when the contact has been promoted to a portal user. */
  userId: string | null
  /** Every company they belong to, main company first. */
  companies: CliContactCompany[]
  createdAt: string
  updatedAt: string
}

/** Portal access is a client record: only people who manage clients see it. */
type ViewerOptions = { viewerRole?: Role | null }

export function serializeContactCompanies(
  memberships: readonly ContactMembership[],
  { viewerRole }: ViewerOptions = {}
): CliContactCompany[] {
  const seesPortal = roleCan(viewerRole, 'clients.manage')
  return memberships.map(membership => ({
    companyId: membership.companyId,
    companyName: membership.companyName,
    title: membership.title,
    isPrimary: membership.isPrimary,
    ...(seesPortal ? { portalAccess: membership.hasPortalAccess } : {}),
    clientId: membership.clientId,
  }))
}

export function serializeContact(
  contact: ContactsSettingsListItem,
  memberships: readonly ContactMembership[] = [],
  options: ViewerOptions = {}
): CliContact {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    userId: contact.userId,
    companies: serializeContactCompanies(memberships, options),
    createdAt: isoTimestamp(contact.createdAt),
    updatedAt: isoTimestamp(contact.updatedAt),
  }
}
