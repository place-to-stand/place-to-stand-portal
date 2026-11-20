'use client'

import { forwardRef, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { ListIndentDecrease, ListIndentIncrease } from 'lucide-react'

import type { ButtonProps } from '@/components/tiptap-ui-primitive/button'
import { Button } from '@/components/tiptap-ui-primitive/button'
import { KeyCaps } from '@/components/keyboard/shortcut-keys'
import type { ListIndentDirection } from '@/lib/tiptap/list-indent'

import { useListIndent } from './use-list-indent'

export interface ListIndentButtonProps extends Omit<ButtonProps, 'type'> {
  direction: ListIndentDirection
  editor?: Editor | null
  /** Optional text beside the icon (the list menu shows it). */
  text?: string
  /** Show the key (Tab, Shift+Tab) as a badge. */
  showShortcut?: boolean
}

const ICONS = {
  indent: ListIndentIncrease,
  outdent: ListIndentDecrease,
} as const

/**
 * Moves the list item under the cursor a level in or out, the same as Tab
 * and Shift+Tab. Disabled outside a list, and where the item can't move
 * (the first item has nothing to nest under). Lives in the list menu: the
 * toolbar has no room for two more buttons at the sheet's 720px width.
 */
export const ListIndentButton = forwardRef<
  HTMLButtonElement,
  ListIndentButtonProps
>(
  (
    { direction, editor, text, showShortcut = false, onClick, ...buttonProps },
    ref
  ) => {
    const { canChange, handleChange, label, shortcutKeys } = useListIndent({
      editor,
      direction,
    })
    const Icon = ICONS[direction]

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        handleChange()
      },
      [handleChange, onClick]
    )

    return (
      <Button
        type='button'
        data-style='ghost'
        role='button'
        tabIndex={-1}
        disabled={!canChange}
        data-disabled={!canChange}
        aria-label={label}
        tooltip={label}
        shortcutKeys={shortcutKeys}
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        <Icon className='tiptap-button-icon' />
        {text && <span className='tiptap-button-text'>{text}</span>}
        {showShortcut && (
          <span className='ml-auto pl-3'>
            <KeyCaps keys={shortcutKeys} size='sm' />
          </span>
        )}
      </Button>
    )
  }
)

ListIndentButton.displayName = 'ListIndentButton'
