import type { LeadStatusValue } from '@/lib/leads/constants'

/** One row on the Companies page. */
export type CompanyListItem = {
  id: string
  name: string
  website: string | null
  ownerId: string | null
  ownerName: string | null
  ownerAvatarUrl: string | null
  clientId: string | null
  clientName: string | null
  contactCount: number
  /** Leads not yet won, lost or unqualified. */
  openLeadCount: number
  championName: string | null
  updatedAt: string
  deletedAt: string | null
}

export type CompanyContactSummary = {
  id: string
  name: string
  email: string
  jobTitle: string | null
  linkedinUrl: string | null
  isChampion: boolean
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
  notes: string | null
  ownerId: string | null
  clientId: string | null
  clientName: string | null
  clientSlug: string | null
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
}

export type CompanyOwnerOption = {
  id: string
  name: string
  avatarUrl: string | null
}

export type CompanyActionResult = {
  ok: boolean
  error?: string
  id?: string
}
