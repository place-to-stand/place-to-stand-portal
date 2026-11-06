'use client'

import { forwardRef } from 'react'

import { Kbd } from '@pts/ui/kbd'

// --- Shared UI ---
// Toolbar tooltips use the portal-wide tooltip so their offset, arrow and
// colours match every other tooltip instead of a separate floating-ui copy.
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'

// --- Lib ---
import { useIsMac } from '@/components/keyboard/shortcut-keys'
import { formatShortcut } from '@/lib/keyboard/format'
import { cn } from '@/lib/tiptap-utils'

import '@/components/tiptap-ui-primitive/button/button-colors.scss'
import '@/components/tiptap-ui-primitive/button/button-group.scss'
import '@/components/tiptap-ui-primitive/button/button.scss'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string
  showTooltip?: boolean
  tooltip?: React.ReactNode
  shortcutKeys?: string
}

/**
 * The shortcut after the tooltip's label, as the same key chip every other
 * tooltip uses (RowActionButton: "Undo ⌘Z").
 */
function ShortcutChip({ shortcutKeys }: { shortcutKeys?: string }) {
  const isMac = useIsMac()
  if (!shortcutKeys) return null
  return <Kbd className='ml-2'>{formatShortcut(shortcutKeys, isMac)}</Kbd>
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      tooltip,
      showTooltip = true,
      shortcutKeys,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    if (!tooltip || !showTooltip) {
      return (
        <button
          className={cn('tiptap-button', className)}
          ref={ref}
          aria-label={ariaLabel}
          {...props}
        >
          {children}
        </button>
      )
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn('tiptap-button', className)}
            ref={ref}
            aria-label={ariaLabel}
            {...props}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {tooltip}
          <ShortcutChip shortcutKeys={shortcutKeys} />
        </TooltipContent>
      </Tooltip>
    )
  }
)

Button.displayName = 'Button'

export const ButtonGroup = forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    orientation?: 'horizontal' | 'vertical'
  }
>(({ className, children, orientation = 'vertical', ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('tiptap-button-group', className)}
      data-orientation={orientation}
      role='group'
      {...props}
    >
      {children}
    </div>
  )
})
ButtonGroup.displayName = 'ButtonGroup'

export default Button
