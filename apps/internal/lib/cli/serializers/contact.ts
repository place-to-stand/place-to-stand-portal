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
   * portal login). Only for callers who manage clients; omitted otherwise.
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
  /**
   * Their sign-in, if they have one. Only for callers who manage clients;
   * omitted otherwise.
   */
  userId?: string | null
  /** Every company they belong to, main company first. */
  companies: CliContactCompany[]
  createdAt: string
  updatedAt: string
}

/** What the caller may see: portal access and sign-ins need `clients.manage`. */
export type ContactViewer = { seesPortalAccess: boolean }

export function serializeContactCompanies(
  memberships: readonly ContactMembership[],
  viewer: ContactViewer
): CliContactCompany[] {
  return memberships.map(membership => ({
    companyId: membership.companyId,
    companyName: membership.companyName,
    title: membership.title,
    isPrimary: membership.isPrimary,
    ...(viewer.seesPortalAccess
      ? { portalAccess: membership.hasPortalAccess }
      : {}),
    clientId: membership.clientId,
  }))
}

export function serializeContact(
  contact: ContactsSettingsListItem,
  memberships: readonly ContactMembership[] = [],
  viewer: ContactViewer
): CliContact {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    ...(viewer.seesPortalAccess ? { userId: contact.userId } : {}),
    companies: serializeContactCompanies(memberships, viewer),
    createdAt: isoTimestamp(contact.createdAt),
    updatedAt: isoTimestamp(contact.updatedAt),
  }
}
