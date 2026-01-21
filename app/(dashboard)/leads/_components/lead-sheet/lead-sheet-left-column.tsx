'use client'

import { Control } from 'react-hook-form'

import type { LeadSourceTypeValue } from '@/lib/leads/constants'
import type { LeadAssigneeOption } from '@/lib/leads/types'

import { LeadSheetFormFields } from './lead-sheet-form-fields'
import type { LeadFormValues } from './types'

type LeadSheetLeftColumnProps = {
  control: Control<LeadFormValues>
  assignees: LeadAssigneeOption[]
  selectedSourceType: LeadSourceTypeValue | null | undefined
}

export function LeadSheetLeftColumn({
  control,
  assignees,
  selectedSourceType,
}: LeadSheetLeftColumnProps) {
  return (
    <div className='flex-1 overflow-y-auto border-r'>
      <div className='p-6'>
        <LeadSheetFormFields
          control={control}
          assignees={assignees}
          selectedSourceType={selectedSourceType}
        />
      </div>
    </div>
  )
}
