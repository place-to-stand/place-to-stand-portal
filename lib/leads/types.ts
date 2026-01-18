import type { LeadSourceTypeValue, LeadStatusValue } from './constants'
import type { LeadSignal, PriorityTier } from './intelligence-types'

export type LeadRecord = {
  id: string
  contactName: string
  status: LeadStatusValue
  sourceType: LeadSourceTypeValue | null
  sourceDetail: string | null
  assigneeId: string | null
  assigneeName: string | null
  assigneeEmail: string | null
  assigneeAvatarUrl: string | null
  contactEmail: string | null
  contactPhone: string | null
  companyName: string | null
  companyWebsite: string | null
  notesHtml: string
  rank: string
  createdAt: string
  updatedAt: string

  // AI Scoring
  overallScore: number | null
  priorityTier: PriorityTier | null
  signals: LeadSignal[]
  lastScoredAt: string | null

  // Activity Tracking
  lastContactAt: string | null
  awaitingReply: boolean

  // Predictions
  predictedCloseProbability: number | null
  estimatedValue: number | null
  expectedCloseDate: string | null

  // Conversion
  convertedAt: string | null
  convertedToClientId: string | null
}

export type LeadBoardColumnData = {
  id: LeadStatusValue
  label: string
  description: string
  leads: LeadRecord[]
}

export type LeadAssigneeOption = {
  id: string
  name: string
  email: string | null
  avatarUrl: string | null
}
