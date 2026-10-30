import type { LeadStatusValue } from '@/lib/leads/constants'

/** One row on the Companies page. */
export type CompanyListItem = {
  id: string
  name: string
  website: string | null
  /** The company's (first live) client, when it has signed. */
  clientId: string | null
  clientName: string | null
  /** Was a client (billing stopped), not one now. */
  formerClient: boolean
  /** The company's people, for the People hover card. */
  people: {
    id: string
    name: string
    email: string | null
    jobTitle: string | null
    /** The company's primary contact (listed first). */
    isPrimary: boolean
  }[]
  /** Leads not yet won, lost or unqualified. */
  openLeads: { id: string; contactName: string; status: LeadStatusValue }[]
  contactCount: number
  openLeadCount: number
  primaryContactName: string | null
  updatedAt: string
  deletedAt: string | null
}

export type CompanyContactSummary = {
  id: string
  name: string
  email: string | null
  jobTitle: string | null
  linkedinUrl: string | null
  /** The company's primary contact (clients use it too). */
  isPrimary: boolean
  /** Can see the company's client in the client portal. */
  portalAccess: boolean
  /** Has a portal login. */
  hasPortalLogin: boolean
}

export type CompanyLeadSummary = {
  id: string
  contactName: string
  status: LeadStatusValue
  assigneeName: string | null
  updatedAt: string
}

/** Everything the company sheet shows. */
export type CompanyDetail = {
  id: string
  name: string
  website: string | null
  linkedinUrl: string | null
  /** Rich text (TipTap HTML); older rows may be plain text. */
  notes: string | null
  primaryContactId: string | null
  primaryContactName: string | null
  /** Clients that are this company (usually one). */
  clients: { id: string; name: string; slug: string | null }[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  contacts: CompanyContactSummary[]
  leads: CompanyLeadSummary[]
}

/** A client offered on the company sheet's client picker. */
export type ClientLinkOption = {
  id: string
  name: string
  companyId: string | null
  companyName: string | null
}

/** Picker option on the lead and contact sheets. */
export type CompanyOption = {
  id: string
  name: string
  website: string | null
}

export type CompanyActionResult = {
  ok: boolean
  error?: string
  id?: string
}
