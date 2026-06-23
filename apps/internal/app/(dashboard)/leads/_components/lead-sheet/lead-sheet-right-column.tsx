'use client'

import type { LeadRecord } from '@/lib/leads/types'

import { LeadTasksSection } from './lead-tasks-section'

type LeadSheetRightColumnProps = {
  lead: LeadRecord
  canManage: boolean
  onSuccess: () => void
}

export function LeadSheetRightColumn({
  lead,
  canManage,
  onSuccess,
}: LeadSheetRightColumnProps) {
  return (
    <div className='bg-muted/20 w-80 flex-shrink-0 overflow-y-auto lg:w-96'>
      <div className='space-y-6 p-6'>
        {/* Tasks */}
        <LeadTasksSection
          lead={lead}
          canManage={canManage}
          onSuccess={onSuccess}
        />
      </div>
    </div>
  )
}
