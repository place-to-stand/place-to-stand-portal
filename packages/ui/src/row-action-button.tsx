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
}

/**
 * An icon-only action in a table row or toolbar: a compact icon button with a
 * real tooltip and a matching accessible name. Use instead of a Button with
 * `title=`, which only shows a delayed native tooltip.
 */
export function RowActionButton({
  label,
  icon,
  variant = 'ghost',
  ...props
}: RowActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} size='icon-sm' aria-label={label} {...props}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
