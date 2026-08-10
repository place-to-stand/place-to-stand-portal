'use client'

import { type ReactNode } from 'react'
import { Archive, Redo2, Undo2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

/**
 * The sheet footer chrome on its own — for sheets whose actions aren't the
 * standard save/undo/redo group (e.g. the read-only submission sheet).
 * Children lay out in a justified row; put primary actions in a left group
 * and the destructive action last.
 */
export function SheetFooterBar({ children }: { children: ReactNode }) {
  return (
    <div className='border-border/40 bg-muted/95 supports-backdrop-filter:bg-muted/90 z-10 w-full border-t shadow-lg backdrop-blur'>
      <div className='flex w-full items-center justify-between gap-2 p-2.5'>
        {children}
      </div>
    </div>
  )
}

export type SheetFormFooterProps = {
  /** The id of the <form> the submit button targets. */
  formId: string
  saveLabel: string
  submitDisabled: boolean
  submitDisabledReason: string | null
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  isEditing: boolean
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  onRequestDelete: () => void
  /** Accessible label for the destructive button, e.g. 'Archive task'. */
  deleteAriaLabel: string
}

export function SheetFormFooter(props: SheetFormFooterProps) {
  const {
    formId,
    saveLabel,
    submitDisabled,
    submitDisabledReason,
    undo,
    redo,
    canUndo,
    canRedo,
    isEditing,
    deleteDisabled,
    deleteDisabledReason,
    onRequestDelete,
    deleteAriaLabel,
  } = props

  return (
    <SheetFooterBar>
      <div className='flex items-center gap-1.5'>
        <DisabledFieldTooltip
          disabled={submitDisabled}
          reason={submitDisabledReason}
        >
          <Button
            type='submit'
            form={formId}
            size='sm'
            disabled={submitDisabled}
            aria-label={`${saveLabel} (⌘S / Ctrl+S)`}
            title={`${saveLabel} (⌘S / Ctrl+S)`}
          >
            {saveLabel}
          </Button>
        </DisabledFieldTooltip>
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='h-8 w-8'
          onClick={undo}
          disabled={!canUndo}
          aria-label='Undo (⌘Z / Ctrl+Z)'
          title='Undo (⌘Z / Ctrl+Z)'
        >
          <Undo2 className='h-4 w-4' />
        </Button>
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='h-8 w-8'
          onClick={redo}
          disabled={!canRedo}
          aria-label='Redo (⇧⌘Z / Ctrl+Shift+Z)'
          title='Redo (⇧⌘Z / Ctrl+Shift+Z)'
        >
          <Redo2 className='h-4 w-4' />
        </Button>
      </div>
      {isEditing ? (
        <DisabledFieldTooltip
          disabled={deleteDisabled}
          reason={deleteDisabledReason}
        >
          <Button
            type='button'
            variant='destructive'
            onClick={onRequestDelete}
            disabled={deleteDisabled}
            aria-label={deleteAriaLabel}
            title={deleteAriaLabel}
            size='icon'
            className='h-8 w-8'
          >
            <Archive className='h-4 w-4' />
          </Button>
        </DisabledFieldTooltip>
      ) : null}
    </SheetFooterBar>
  )
}
