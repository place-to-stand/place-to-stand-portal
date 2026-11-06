import * as React from 'react'

import { cn } from './cn'

const SIZES = {
  default: 'h-5 min-w-5 px-1.5 text-xs',
  sm: 'min-w-4 px-1 text-micro',
} as const

/**
 * One key (`⌘`, `K`). The system font, which draws ⌘ ⇧ ⌥ properly (the
 * brand fonts don't have them), on the muted surface with a hairline border, the same look in the sidebar, menus, tooltips and the shortcuts list.
 */
function Kbd({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<'kbd'> & { size?: keyof typeof SIZES }) {
  return (
    <kbd
      data-slot='kbd'
      className={cn(
        'bg-muted text-muted-foreground pointer-events-none inline-flex items-center justify-center rounded-sm border font-[system-ui] leading-none whitespace-nowrap select-none',
        // Inside a tooltip (dark on light) the chip inverts to stay readable.
        'in-data-[slot=tooltip-content]:border-primary-foreground/25 in-data-[slot=tooltip-content]:bg-primary-foreground/10 in-data-[slot=tooltip-content]:text-primary-foreground',
        SIZES[size],
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
