import type { LeadStatusValue } from '@/lib/leads/constants'

export type StatusCount = {
  status: LeadStatusValue
  count: number
}

export type ConversionCount = {
  fromStatus: LeadStatusValue | null
  toStatus: LeadStatusValue
  count: number
}

export type FunnelData = {
  statusCounts: StatusCount[]
  conversions: ConversionCount[]
}

export type MonthlyWon = {
  month: string
  total: number
  count: number
}

export type RevenueMetrics = {
  totalPipeline: number
  weightedPipeline: number
  totalWonRevenue: number
  winRate: number
  wonCount: number
  lostCount: number
  avgDealSize: number
  monthlyWon: MonthlyWon[]
}

export type TimeInStage = {
  status: LeadStatusValue
  avgDays: number
}

export type AgingLead = {
  id: string
  contactName: string
  companyName: string | null
  status: LeadStatusValue
  currentStageEnteredAt: string | null
  estimatedValue: number
  daysInStage: number
}

export type VelocityMetrics = {
  avgDaysToClose: number
  timeInStage: TimeInStage[]
  agingLeads: AgingLead[]
}

export type ActivityMetrics = {
  meetingsScheduled: number
  proposalsSent: number
  leadsContacted: number
  newLeads: number
}

export type PipelineAnalytics = {
  funnel: FunnelData
  revenue: RevenueMetrics
  velocity: VelocityMetrics
  activity: ActivityMetrics
}
