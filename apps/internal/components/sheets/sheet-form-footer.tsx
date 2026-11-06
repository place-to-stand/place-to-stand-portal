'use client'

import { type ReactNode } from 'react'
import { Redo2, Undo2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { RowActionButton } from '@pts/ui/row-action-button'
import { ShortcutKeys } from '@/components/keyboard/shortcut-keys'
import { rowActionShortcut } from '@/components/keyboard/shortcut-tooltip'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { ariaKeyShortcuts } from '@/lib/keyboard/format'
import { SHORTCUTS } from '@/lib/keyboard/shortcuts'
import type { SheetSaveMode } from '@/lib/sheets/save-mode'

/** The key chip inside the solid primary button, inverted to stay readable. */
const ON_PRIMARY =
  'border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground'

/**
 * The sheet footer chrome on its own — for sheets whose actions aren't the
 * standard save/undo/redo group (e.g. the read-only submission sheet).
 * Children lay out in a justified row: secondary actions in a left group,
 * the primary action last on the right.
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
  /**
   * The sheet's submit label ("Save changes", "Create task", "Saving...").
   * Only its in-flight form ("Saving...", "Creating...") is shown as is; at
   * rest the two buttons read "Save" / "Save and close" (create: "Create" /
   * "Create and close").
   */
  saveLabel: string
  /**
   * Save and keep the sheet open: the outline button and ⇧⌘S. Must run the
   * same submit function as the primary button, with mode `stay`.
   */
  onSave: (mode: SheetSaveMode) => void
  submitDisabled: boolean
  submitDisabledReason: string | null
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  isEditing: boolean
}

/**
 * The sheet footer: it only saves. Undo and redo on the left; Save (keep
 * open) and the primary Save and close on the right, primary last like the
 * portal's dialogs. The record's own actions (Duplicate, Archive) live in the
 * header's Actions menu (`SheetRecordMenu`).
 */
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
    onSave,
  } = props

  const verb = isEditing ? 'Save' : 'Create'
  const inFlight = saveLabel.endsWith('...')

  return (
    <SheetFooterBar>
      <div className='flex items-center gap-1.5'>
        <RowActionButton
          type='button'
          variant='outline'
          onClick={undo}
          disabled={!canUndo}
          label='Undo'
          {...rowActionShortcut(SHORTCUTS.undo)}
          icon={<Undo2 />}
        />
        <RowActionButton
          type='button'
          variant='outline'
          onClick={redo}
          disabled={!canRedo}
          label='Redo'
          {...rowActionShortcut(SHORTCUTS.redo)}
          icon={<Redo2 />}
        />
      </div>
      <div className='flex items-center gap-1.5'>
        <DisabledFieldTooltip
          disabled={submitDisabled}
          reason={submitDisabledReason}
        >
          <Button
            type='button'
            variant='outline'
            // xs (28px) to match the icon actions: one height per row.
            size='xs'
            disabled={submitDisabled}
            onClick={() => onSave('stay')}
            aria-label={`${verb} and keep open`}
            aria-keyshortcuts={ariaKeyShortcuts(SHORTCUTS.saveAndStay)}
          >
            {verb}
            {/* The key sits in the button itself (Jason, Nov 6): the save
                keys are the ones used every day. */}
            <ShortcutKeys shortcut={SHORTCUTS.saveAndStay} size='sm' />
          </Button>
        </DisabledFieldTooltip>
        <DisabledFieldTooltip
          disabled={submitDisabled}
          reason={submitDisabledReason}
        >
          {/* Submits the form, so Enter in a field also saves and closes. */}
          <Button
            type='submit'
            form={formId}
            size='xs'
            disabled={submitDisabled}
            aria-label={`${verb} and close`}
            aria-keyshortcuts={ariaKeyShortcuts(SHORTCUTS.save)}
          >
            {inFlight ? saveLabel : `${verb} and close`}
            <ShortcutKeys
              shortcut={SHORTCUTS.save}
              size='sm'
              kbdClassName={ON_PRIMARY}
            />
          </Button>
        </DisabledFieldTooltip>
      </div>
    </SheetFooterBar>
  )
}
