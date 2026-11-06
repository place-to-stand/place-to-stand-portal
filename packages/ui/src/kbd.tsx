import * as React from 'react'

import { cn } from './cn'

const SIZES = {
  default: 'h-5 min-w-5 px-1.5 text-xs',
  sm: 'min-w-4 px-1 text-micro',
} as const

/**
 * A key or key combination (`⌘K`). Mono on the muted surface with a hairline
 * border, the same look in the sidebar, menus and the shortcuts list.
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
        'bg-muted text-muted-foreground pointer-events-none inline-flex items-center justify-center rounded-sm border font-mono leading-none whitespace-nowrap select-none',
        SIZES[size],
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
