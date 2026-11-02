'use client'

import { useRef, useState, type ReactElement, type ReactNode } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'

/**
 * Shows `content` in a tooltip only when the child's text is cut off
 * (ellipsis), so a name that fits never gets a tooltip repeating it. The
 * child must be one element that truncates itself (e.g. `truncate`).
 */
export function TruncationTooltip({
  content,
  children,
}: {
  content: ReactNode
  children: ReactElement
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <Tooltip
      open={open}
      onOpenChange={next => {
        const element = triggerRef.current
        const truncated = Boolean(
          element && element.scrollWidth > element.clientWidth
        )
        setOpen(next && truncated)
      }}
    >
      <TooltipTrigger asChild ref={triggerRef}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  )
}
