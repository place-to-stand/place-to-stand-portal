import type { LeadStatusValue } from '@/lib/leads/constants'

/** One row on the Companies page. */
export type CompanyListItem = {
  id: string
  name: string
  website: string | null
  /** The company's (first live) client, when it has signed. */
  companyId: string | null
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
  /** Why this user can't archive or restore it (the staff company, for Sales). */
  archiveRefusal: string | null
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
  /**
   * Can see the company's client in the client portal. Always false for a
   * viewer who can't manage clients (sign-in details stay hidden from them).
   */
  portalAccess: boolean
  /** Has a sign-in (false for a viewer who can't manage clients). */
  hasPortalLogin: boolean
  /**
   * Has a sign-in and the viewer isn't an admin: only an admin moves them
   * between companies (the person sheet shows them read-only too).
   */
  signInLocked: boolean
  /** Their sign-in is switched off or archived: no access until it's back. */
  signInDisabled: boolean
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
  /** Its stopped client when it has no live one (billing can restart). */
  formerClientId: string | null
  /**
   * The last month billed when a stop is scheduled (billed through the end
   * of this month); null while billing runs on or isn't open.
   */
  billingEndsOn: string | null
  /** The agency's own company (`companies.is_staff`). */
  isStaff: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  contacts: CompanyContactSummary[]
  leads: CompanyLeadSummary[]
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
