'use client'

import { FIELD_STACK_CLASS } from '@/components/ui/form'
import { LeadRecordRow } from '@/components/sheets/entity-record-rows'
import type { TaskLead } from '@/lib/types'

/**
 * The lead this task is linked to, as its record row; a click stacks the
 * lead's sheet. Always shown, even over that lead's own sheet, so the task
 * sheet looks the same wherever it opens.
 */
export function TaskLeadField({ lead }: { lead: TaskLead | null }) {
  if (!lead) return null

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
