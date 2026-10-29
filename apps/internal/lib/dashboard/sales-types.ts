import type { LeadStatusValue } from '@/lib/leads/constants'

/** An open task on the sales home's Next steps list. */
export type SalesTaskItem = {
  id: string
  title: string
  status: 'ON_DECK' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'
  dueOn: string | null
  projectName: string
  leadId: string | null
  leadName: string | null
}

/** A lead on the "gone quiet" and "waiting on a reply" lists. */
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
  nextSteps: SalesTaskItem[]
  nextStepsTotal: number
  quietLeads: SalesLeadItem[]
  awaitingReply: SalesLeadItem[]
  pipeline: SalesPipelineStage[]
}
