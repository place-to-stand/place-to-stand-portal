'use client'

import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'
import { cn } from '@/lib/utils'

type ProjectsAddButtonProps = {
  clients: ClientRow[]
  className?: string
}

export function ProjectsAddButton({
  clients,
  className,
}: ProjectsAddButtonProps) {
  // Opens `?project=new`; the global SheetHost renders the create sheet, so
  // this button doesn't own a duplicate instance. (Project *edit* sheets stay
  // page-local: the board and settings tables pass contractor membership the
  // host can't supply.)
  const { openCreate } = useSheetParamSelection('project')

  const createDisabled = clients.length === 0
  const createDisabledReason = createDisabled
    ? 'Add a client before creating a project.'
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
          Add project
        </Button>
      </DisabledFieldTooltip>
    </div>
  )
}
