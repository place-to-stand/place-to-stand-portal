'use client'

import type { ComponentProps, ReactNode } from 'react'

import { buttonVariants, type IconSize } from './button'
import { cn } from './cn'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

type RowActionButtonProps = Omit<
  ComponentProps<'button'>,
  'children' | 'title' | 'aria-label'
> &
  Pick<Parameters<typeof buttonVariants>[0] & {}, 'variant'> & {
    /** What the action does ("Archive client"): the tooltip and the accessible name. */
    label: string
    icon: ReactNode
    /**
     * The action's keyboard shortcut, shown after the label in the tooltip
     * (the internal portal passes `<ShortcutKeys shortcut={SHORTCUTS.x} />`).
     */
    shortcut?: ReactNode
    /** `icon` (36px) only where it sits beside default-height controls. */
    size?: IconSize
    /**
     * `false` only for the trigger of a menu or popover, whose popup is
     * labelled; the label still names the button.
     */
    tooltip?: boolean
  }

/**
 * The one icon-only button (house rule 11): a compact icon button with a real
 * tooltip and a matching accessible name. Button has no icon sizes, so an
 * icon-only action can't skip the label.
 */
export function RowActionButton({
  label,
  icon,
  shortcut,
  variant = 'ghost',
  size = 'icon-sm',
  tooltip = true,
  className,
  ...props
}: RowActionButtonProps) {
  const button = (
    <button
      data-slot='button'
      aria-label={label}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {icon}
    </button>
  )
  if (!tooltip) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? <span className='ml-2'>{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  )
}
