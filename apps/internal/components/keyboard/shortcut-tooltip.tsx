'use client'

import type { ReactElement } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'

import { ariaKeyShortcuts } from '@/lib/keyboard/format'
import type { Shortcut } from '@/lib/keyboard/shortcuts'

import { ShortcutKeys } from './shortcut-keys'

type Props = {
  shortcut: Shortcut
  /** Text before the keys. Leave out when the control already shows it ("Save"). */
  label?: string
  children: ReactElement
}

/**
 * Shows a control's keyboard shortcut on hover, so it can be learned where it
 * is used without adding anything to the screen. For an icon-only action pass
 * `shortcut` to RowActionButton instead; it already has a tooltip.
 */
export function ShortcutTooltip({ shortcut, label, children }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild aria-keyshortcuts={ariaKeyShortcuts(shortcut)}>
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label ? <span className='mr-2'>{label}</span> : null}
        <ShortcutKeys shortcut={shortcut} />
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Props that put a shortcut on a RowActionButton: the keys in its tooltip and
 * `aria-keyshortcuts` for screen readers.
 * `<RowActionButton label='Undo' {...rowActionShortcut(SHORTCUTS.undo)} />`
 */
export function rowActionShortcut(shortcut: Shortcut) {
  return {
    shortcut: <ShortcutKeys shortcut={shortcut} />,
    'aria-keyshortcuts': ariaKeyShortcuts(shortcut),
  }
}
