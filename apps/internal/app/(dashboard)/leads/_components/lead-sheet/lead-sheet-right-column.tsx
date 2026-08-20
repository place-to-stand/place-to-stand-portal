'use client'

import type { LeadRecord } from '@/lib/leads/types'

import { LeadTasksSection } from './lead-tasks-section'
import { LeadUpdatesSection } from './updates/lead-updates-section'

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
      <div className='space-y-10 p-6'>
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
