import type { LeadStatusValue } from '@/lib/leads/constants'

/** A lead on the Aging leads list. */
export type SalesLeadItem = {
  id: string
  contactName: string
  companyName: string | null
  status: LeadStatusValue
  /** Newest logged update, else when the lead was created. */
  lastTouchedAt: string
  daysSinceTouch: number
}

export type SalesPipelineStage = {
  status: LeadStatusValue
  label: string
  /** Every open lead in this stage. */
  total: number
  /** The viewer's own leads in this stage. */
  mine: number
}

export type SalesHomeData = {
  /** Today in the company time zone (YYYY-MM-DD). */
  today: string
  quietLeads: SalesLeadItem[]
  pipeline: SalesPipelineStage[]
}
