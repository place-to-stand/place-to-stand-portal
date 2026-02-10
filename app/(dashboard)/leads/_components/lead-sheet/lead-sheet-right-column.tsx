'use client'

import { Separator } from '@/components/ui/separator'
import type { LeadAssigneeOption, LeadRecord } from '@/lib/leads/types'

import { LeadMeetingsSection } from '../lead-meetings-section'
import { LeadProposalsSection } from '../lead-proposals-section'
import type { EditableProposal } from '../proposal-builder/proposal-builder-sheet'
import { LeadSuggestionsPanel } from '../lead-suggestions-panel'
import { LeadActionsPanel } from './lead-actions-panel'
import { LeadTasksSection } from './lead-tasks-section'
import { LeadEmailSuggestionsSection } from './lead-email-suggestions-section'
import { LeadTranscriptSuggestionsSection } from './lead-transcript-suggestions-section'

type LeadSheetRightColumnProps = {
  lead: LeadRecord
  assignees: LeadAssigneeOption[]
  canManage: boolean
  senderName?: string
  canConvert: boolean
  isConverted: boolean
  onSendEmail: () => void
  onScheduleMeeting: (initialTitle?: string) => void
  onBuildProposal: () => void
  onEditProposal: (proposal: EditableProposal) => void
  onConvertToClient: () => void
  onRescore?: () => void
  isRescoring?: boolean
  onSuccess: () => void
}

export function LeadSheetRightColumn({
  lead,
  assignees,
  canManage,
  senderName = '',
  canConvert,
  isConverted,
  onSendEmail,
  onScheduleMeeting,
  onBuildProposal,
  onEditProposal,
  onConvertToClient,
  onRescore,
  isRescoring = false,
  onSuccess,
}: LeadSheetRightColumnProps) {
  return (
    <div className='bg-muted/20 w-80 flex-shrink-0 overflow-y-auto lg:w-96'>
      <div className='space-y-6 p-6'>
        {/* Quick Actions */}
        <LeadActionsPanel
          canManage={canManage}
          canConvert={canConvert}
          isConverted={isConverted}
          onSendEmail={onSendEmail}
          onScheduleMeeting={() => onScheduleMeeting()}
          onBuildProposal={onBuildProposal}
          onConvertToClient={onConvertToClient}
          onRescore={onRescore}
          isRescoring={isRescoring}
        />

        {/* AI Suggestions */}
        {canManage && (
          <>
            <Separator />
            <LeadSuggestionsPanel
              leadId={lead.id}
              isAdmin={canManage}
              onScheduleCall={onScheduleMeeting}
              onSendProposal={onBuildProposal}
            />
          </>
        )}

        {/* Tasks */}
        <Separator />
        <LeadTasksSection
          lead={lead}
          assignees={assignees}
          canManage={canManage}
          onSuccess={onSuccess}
        />

        {/* Meetings */}
        <Separator />
        <LeadMeetingsSection
          lead={lead}
          onSuccess={onSuccess}
        />

        {/* Proposals */}
        <Separator />
        <LeadProposalsSection
          lead={lead}
          canManage={canManage}
          senderName={senderName}
          onEditProposal={onEditProposal}
          onSuccess={onSuccess}
        />

        {/* Email Threads (context opt-in) */}
        <LeadEmailSuggestionsSection
          leadId={lead.id}
          isAdmin={canManage}
        />

        {/* Transcripts (context opt-in) */}
        <LeadTranscriptSuggestionsSection
          leadId={lead.id}
          isAdmin={canManage}
        />
      </div>
    </div>
  )
}
