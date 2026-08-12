'use client'

import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'
import type { ClientRow } from '@/lib/settings/hour-blocks/hour-block-form'
import { cn } from '@/lib/utils'

type HourBlocksAddButtonProps = {
  clients: ClientRow[]
  className?: string
}

export function HourBlocksAddButton({
  clients,
  className,
}: HourBlocksAddButtonProps) {
  // Opens `?hour-block=new`; the table's single sheet instance renders it,
  // so this button doesn't own a duplicate copy.
  const { openCreate } = useSheetParamSelection('hour-block')

  const createDisabled = clients.length === 0
  const createDisabledReason = createDisabled
    ? 'Add a client before creating an hour block.'
    : null

  return (
    <div className={cn(className)}>
      <DisabledFieldTooltip
        disabled={createDisabled}
        reason={createDisabledReason}
      >
        <Button
          size='sm'
          type='button'
          onClick={openCreate}
          disabled={createDisabled}
          className='gap-2'
        >
          <Plus className='h-4 w-4' />
          Add hour block
        </Button>
      </DisabledFieldTooltip>
    </div>
  )
}
