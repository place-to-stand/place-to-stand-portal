'use client'

import { FIELD_STACK_CLASS } from '@/components/ui/form'
import { LeadRecordRow } from '@/components/sheets/entity-record-rows'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import type { TaskLead } from '@/lib/types'

/**
 * The lead this task is linked to, as its record row; a click stacks the
 * lead's sheet. Left out when the task was opened from that lead's sheet
 * (lead param before the task param), not when the row itself just stacked
 * the lead on top, or the row would vanish before the lead sheet loads.
 */
export function TaskLeadField({ lead }: { lead: TaskLead | null }) {
  const { stack } = useSheetParams()
  if (!lead) return null
  const leadAt = stack.findIndex(
    i => i.entity === 'lead' && i.value === lead.id
  )
  const taskAt = stack.findIndex(i => i.entity === 'task')
  if (leadAt !== -1 && (taskAt === -1 || leadAt < taskAt)) return null

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
