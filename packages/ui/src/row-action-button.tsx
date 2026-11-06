'use client'

import type { ComponentProps, ReactNode } from 'react'

import { Button } from './button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

type RowActionButtonProps = Omit<
  ComponentProps<typeof Button>,
  'size' | 'children' | 'title' | 'aria-label'
> & {
  /** What the action does ("Archive client"): the tooltip and the accessible name. */
  label: string
  icon: ReactNode
  /**
   * The action's keyboard shortcut, shown after the label in the tooltip
   * (the internal portal passes `<ShortcutKeys shortcut={SHORTCUTS.x} />`).
   */
  shortcut?: ReactNode
  /** `icon` (36px) only where it sits beside default-height controls. */
  size?: 'icon-sm' | 'icon'
}

/**
 * An icon-only action in a table row or toolbar: a compact icon button with a
 * real tooltip and a matching accessible name. Use instead of a Button with
 * `title=`, which only shows a delayed native tooltip.
 */
export function RowActionButton({
  label,
  icon,
  shortcut,
  variant = 'ghost',
  size = 'icon-sm',
  ...props
}: RowActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} size={size} aria-label={label} {...props}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? <span className='ml-2'>{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  )
}
