'use client'

import { type ReactNode } from 'react'
import { Archive, Redo2, Undo2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { RowActionButton } from '@pts/ui/row-action-button'
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
  archiveDisabled: boolean
  archiveDisabledReason: string | null
  onRequestArchive: () => void
  /** Accessible label for the destructive button, e.g. 'Archive task'. */
  archiveAriaLabel: string
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
    archiveDisabled,
    archiveDisabledReason,
    onRequestArchive,
    archiveAriaLabel,
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
            // xs (28px) to match the icon actions beside it: one height per row.
            size='xs'
            disabled={submitDisabled}
            aria-label={`${saveLabel} (⌘S / Ctrl+S)`}
          >
            {saveLabel}
          </Button>
        </DisabledFieldTooltip>
        <RowActionButton
          type='button'
          variant='outline'
          onClick={undo}
          disabled={!canUndo}
          label='Undo (⌘Z / Ctrl+Z)'
          icon={<Undo2 />}
        />
        <RowActionButton
          type='button'
          variant='outline'
          onClick={redo}
          disabled={!canRedo}
          label='Redo (⇧⌘Z / Ctrl+Shift+Z)'
          icon={<Redo2 />}
        />
      </div>
      {isEditing ? (
        <DisabledFieldTooltip
          disabled={archiveDisabled}
          reason={archiveDisabledReason}
        >
          <Button
            type='button'
            variant='destructive'
            onClick={onRequestArchive}
            disabled={archiveDisabled}
            aria-label={archiveAriaLabel}
            size='icon-sm'
          >
            <Archive />
          </Button>
        </DisabledFieldTooltip>
      ) : null}
    </SheetFooterBar>
  )
}
