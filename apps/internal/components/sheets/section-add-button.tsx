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
 * The small "Add …" button on a sheet section's title row (the client
 * sheet's "Add person" style). Spreads the rest onto the button so it can be
 * a popover trigger.
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
        variant='outline'
        size='xs'
        disabled={isDisabled}
        {...props}
      >
        <Plus />
        {label}
      </Button>
    </DisabledFieldTooltip>
  )
}
