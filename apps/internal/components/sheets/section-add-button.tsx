'use client'

import type { ComponentProps } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

type SectionAddButtonProps = Omit<
  ComponentProps<typeof Button>,
  'children' | 'size' | 'variant'
> & {
  /** "Add person". */
  label: string
  /** Disables the button and explains why in a tooltip. */
  disabledReason?: string | null
}

/**
 * Every sheet section's add button: the + alone (a ghost icon button), its
 * label ("Add person", "Add line item", "Log time") the accessible name.
 * One style everywhere; spreads the rest onto the button so it can be a
 * popover trigger.
 */
export function SectionAddButton({
  label,
  disabledReason = null,
  disabled,
  ...props
}: SectionAddButtonProps) {
  const isDisabled = Boolean(disabled || disabledReason)
  return (
    <DisabledFieldTooltip
      disabled={isDisabled}
      reason={disabledReason}
      className='w-auto'
    >
      <Button
        type='button'
        variant='ghost'
        size='xs'
        disabled={isDisabled}
        aria-label={label}
        {...props}
      >
        <Plus className='h-4 w-4' />
      </Button>
    </DisabledFieldTooltip>
  )
}
