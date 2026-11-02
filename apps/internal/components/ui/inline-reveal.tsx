'use client'

import type { ReactNode } from 'react'

import { Collapsible, CollapsibleContent } from '@pts/ui/collapsible'

import { cn } from '@/lib/utils'

/**
 * Shows or hides an inline form (logging a lead update, adding a comment)
 * by easing its height and opacity over 200ms, so the content below moves
 * instead of jumping. The content stays mounted (hidden) while closed, so
 * it has its full height, rich text editor included, the moment it opens;
 * otherwise the height is measured before the editor loads and snaps at the
 * end. Forms inside reset themselves on open. Reduced motion: it just
 * appears and disappears.
 */
export function InlineReveal({
  open,
  children,
  className,
}: {
  open: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <Collapsible open={open}>
      <CollapsibleContent
        keepMounted
        className={cn(
          'h-[var(--collapsible-panel-height)] overflow-hidden opacity-100 transition-[height,opacity] duration-200 ease-out data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[starting-style]:h-0 data-[starting-style]:opacity-0 motion-reduce:transition-none',
          className
        )}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
