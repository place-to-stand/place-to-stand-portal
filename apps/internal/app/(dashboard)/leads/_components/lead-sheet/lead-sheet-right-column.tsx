'use client'

import { SHEET_SPLIT_SIDE_CLASS } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import type { LeadRecord } from '@/lib/leads/types'

import { LeadConversionSection } from './lead-conversion-section'
import { LeadTasksSection } from './lead-tasks-section'
import { LeadUpdatesSection } from './updates/lead-updates-section'

type LeadSheetRightColumnProps = {
  lead: LeadRecord
  canManage: boolean
  canConvert: boolean
  onConvertToClient: () => void
  onSuccess: () => void
}

export function LeadSheetRightColumn({
  lead,
  canManage,
  canConvert,
  onConvertToClient,
  onSuccess,
}: LeadSheetRightColumnProps) {
  // Conversion creates clients and projects, so it stays admin-only. SALES
  // staff see the lead's tasks on projects they are members of.
  const { isAdmin } = useViewerAccess()

  return (
    <div
      className={cn(
        'bg-muted/20 flex-shrink-0 max-lg:border-t lg:overflow-y-auto',
        SHEET_SPLIT_SIDE_CLASS
      )}
    >
      <div className='space-y-10 p-6'>
        {/* Conversion — renders nothing until the lead is closed won */}
        {isAdmin ? (
          <LeadConversionSection
            lead={lead}
            canConvert={canConvert}
            onConvertToClient={onConvertToClient}
          />
        ) : null}
        {/* Tasks */}
        <LeadTasksSection
          lead={lead}
          canManage={canManage}
          onSuccess={onSuccess}
        />
        {/* Updates sit below Tasks (D6) — keeps the at-a-glance "last touched
            12 days ago, 2 open tasks" read that tabs would hide. */}
        <LeadUpdatesSection
          lead={lead}
          canManage={canManage}
          onSuccess={onSuccess}
        />
      </div>
    </div>
  )
}
