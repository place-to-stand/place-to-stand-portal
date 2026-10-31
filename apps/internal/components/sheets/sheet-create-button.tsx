'use client'

import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import type { SheetEntityKey } from '@/lib/sheets/entities'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'

type SheetCreateButtonProps = {
  entity: SheetEntityKey
  /** "Create company". */
  label: string
  /** Disables the button and explains why in a tooltip. */
  disabledReason?: string | null
  className?: string
  /**
   * A rendered icon (an element, not a component, so server pages can pass
   * it); defaults to a plus.
   */
  icon?: ReactNode
}

/**
 * The page-header "Add …" button. It opens the entity's create sheet through
 * `?<entity>=new`, so the page's own sheet instance (or the global SheetHost
 * on other routes) renders it and the button never mounts one itself.
 */
export function SheetCreateButton({
  entity,
  label,
  disabledReason = null,
  className,
  icon = <Plus className='h-4 w-4' />,
}: SheetCreateButtonProps) {
  const { openCreate } = useSheetParamSelection(entity)
  const disabled = Boolean(disabledReason)

  return (
    <div className={className}>
      <DisabledFieldTooltip disabled={disabled} reason={disabledReason}>
        <Button
          size='sm'
          type='button'
          onClick={openCreate}
          disabled={disabled}
          className='gap-2'
        >
          {icon}
          {label}
        </Button>
      </DisabledFieldTooltip>
    </div>
  )
}
