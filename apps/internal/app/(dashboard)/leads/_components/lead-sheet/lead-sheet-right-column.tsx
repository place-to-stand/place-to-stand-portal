'use client'

import { EntityList } from '@/components/sheets/entity-list'
import { SHEET_SECTIONS_CLASS } from '@/components/sheets/sheet-section'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import { MessageSquareText } from 'lucide-react'
import { SHEET_SIDE_COLUMN_CLASSES } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import type { LeadRecord } from '@/lib/leads/types'

import { LeadConversionSection } from './lead-conversion-section'
import { LeadTasksSection } from './lead-tasks-section'
import { LeadUpdatesSection } from './updates/lead-updates-section'

type LeadSheetRightColumnProps = {
  /** Null while creating: the sections show, waiting for the lead to exist. */
  lead: LeadRecord | null
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
        // The lead's tasks and updates get an even share of the sheet.
        SHEET_SIDE_COLUMN_CLASSES.even
      )}
    >
      {lead ? (
        <div className={cn(SHEET_SECTIONS_CLASS, 'p-6')}>
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
      ) : (
        // Tasks and updates are their own records, saved on their own, and
        // need the lead to point at. Conversion needs a Won lead, so it
        // stays hidden until then.
        <div className={cn(SHEET_SECTIONS_CLASS, 'p-6')}>
          <EntityList
            title='Tasks'
            icon={ENTITY_ICONS.task}
            add={{
              label: 'Add task',
              disabledReason: 'Add tasks after you save the lead.',
            }}
            isEmpty
            emptyMessage='Add tasks after you save the lead.'
          />
          <EntityList
            title='Updates'
            icon={MessageSquareText}
            add={{
              label: 'Add update',
              disabledReason: 'Add updates after you save the lead.',
            }}
            isEmpty
            emptyMessage='Add updates after you save the lead.'
          />
        </div>
      )}
    </div>
  )
}
