'use client'

import { FIELD_STACK_CLASS } from '@/components/ui/form'
import { LeadRecordRow } from '@/components/sheets/entity-record-rows'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import type { TaskLead } from '@/lib/types'

/**
 * The lead this task is linked to, as its record row; a click stacks the
 * lead's sheet. Left out when that lead's sheet is already open beneath.
 */
export function TaskLeadField({ lead }: { lead: TaskLead | null }) {
  const { get } = useSheetParams()
  if (!lead || get('lead') === lead.id) return null

  return (
    <div className={FIELD_STACK_CLASS}>
      {/* A heading, not a <label>: the row is a link, not a control. */}
      <span className='text-sm leading-none font-medium'>Lead</span>
      <LeadRecordRow
        lead={{
          id: lead.id,
          contactName: lead.name,
          status: lead.status,
          assigneeName: lead.assigneeName,
        }}
      />
    </div>
  )
}
