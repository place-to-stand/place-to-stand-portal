import { leadSourceType, leadStatus } from '@/lib/db/schema'
import { BADGE_TINTS } from '@pts/ui/badge-tints'
import { TASK_STATUS_TOKENS } from '@/lib/projects/task-status'

export const LEAD_STATUS_VALUES = leadStatus.enumValues

export type LeadStatusValue = (typeof LEAD_STATUS_VALUES)[number]

export const LEAD_STATUS_LABELS: Record<LeadStatusValue, string> = {
  NEW_OPPORTUNITIES: 'New opportunities',
  ACTIVE_OPPORTUNITIES: 'Active opportunities',
  PROPOSAL_SENT: 'Proposal sent',
  ON_ICE: 'On ice',
  CLOSED_WON: 'Closed won',
  CLOSED_LOST: 'Closed lost',
  UNQUALIFIED: 'Unqualified',
}

const LEAD_STATUS_TOKENS: Record<LeadStatusValue, string> = {
  NEW_OPPORTUNITIES: BADGE_TINTS.sky,
  ACTIVE_OPPORTUNITIES: BADGE_TINTS.violet,
  PROPOSAL_SENT: BADGE_TINTS.amber,
  ON_ICE: BADGE_TINTS.neutral,
  CLOSED_WON: BADGE_TINTS.emerald,
  CLOSED_LOST: BADGE_TINTS.rose,
  UNQUALIFIED: TASK_STATUS_TOKENS.ACCEPTED,
}

export const LEAD_BOARD_COLUMNS = [
  {
    id: 'NEW_OPPORTUNITIES',
    label: LEAD_STATUS_LABELS.NEW_OPPORTUNITIES,
    description: 'Fresh leads awaiting qualification.',
  },
  {
    id: 'ACTIVE_OPPORTUNITIES',
    label: LEAD_STATUS_LABELS.ACTIVE_OPPORTUNITIES,
    description: 'Qualified leads with active engagement.',
  },
  {
    id: 'PROPOSAL_SENT',
    label: LEAD_STATUS_LABELS.PROPOSAL_SENT,
    description: 'Leads that have received a proposal.',
  },
  {
    id: 'ON_ICE',
    label: LEAD_STATUS_LABELS.ON_ICE,
    description: 'Paused leads that may resume later.',
  },
  {
    id: 'CLOSED_WON',
    label: LEAD_STATUS_LABELS.CLOSED_WON,
    description: 'Leads that converted.',
  },
  {
    id: 'CLOSED_LOST',
    label: LEAD_STATUS_LABELS.CLOSED_LOST,
    description: 'Leads that did not convert.',
  },
  {
    id: 'UNQUALIFIED',
    label: LEAD_STATUS_LABELS.UNQUALIFIED,
    description: 'Leads that are no longer a fit or disqualified.',
  },
] as const satisfies ReadonlyArray<{
  id: LeadStatusValue
  label: string
  description: string
}>

export const LEAD_STATUS_ORDER = LEAD_BOARD_COLUMNS.map(column => column.id)

export function getLeadStatusToken(status: LeadStatusValue): string {
  return LEAD_STATUS_TOKENS[status] ?? ''
}

export const LEAD_SOURCE_TYPES = leadSourceType.enumValues

export type LeadSourceTypeValue = (typeof LEAD_SOURCE_TYPES)[number]

export const LEAD_SOURCE_LABELS: Record<LeadSourceTypeValue, string> = {
  REFERRAL: 'Referral',
  WEBSITE: 'Website',
  EVENT: 'Event',
}

export function getLeadSourceLabel(
  source?: LeadSourceTypeValue | null
): string {
  if (!source) {
    return ''
  }

  return LEAD_SOURCE_LABELS[source] ?? source
}

/**
 * Check if a status is terminal (lead lifecycle has ended).
 * Terminal statuses set resolvedAt and may set conversion or loss fields.
 */
export function isTerminalLeadStatus(status: LeadStatusValue): boolean {
  return (
    status === 'CLOSED_WON' ||
    status === 'CLOSED_LOST' ||
    status === 'UNQUALIFIED'
  )
}
