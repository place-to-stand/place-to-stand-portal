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
  /**
   * Just the + (a ghost icon button, like the task sheet's Time logs and
   * Attachments): the label becomes its accessible name.
   */
  iconOnly?: boolean
}

/**
 * The small "Add …" button on a sheet section's title row (the client
 * sheet's "Add person" style). Spreads the rest onto the button so it can be
 * a popover trigger.
 */
export function SectionAddButton({
  label,
  disabledReason = null,
  iconOnly = false,
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
        variant={iconOnly ? 'ghost' : 'outline'}
        size='xs'
        disabled={isDisabled}
        aria-label={iconOnly ? label : undefined}
        {...props}
      >
        <Plus className={iconOnly ? 'h-4 w-4' : undefined} />
        {iconOnly ? null : label}
      </Button>
    </DisabledFieldTooltip>
  )
}
