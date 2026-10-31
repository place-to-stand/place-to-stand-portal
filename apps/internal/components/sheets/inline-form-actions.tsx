'use client'

import { Loader2, Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

/**
 * The buttons under every form that opens in place in an EntityList (post a
 * comment, log a lead update): Cancel (outline) then the action, right
 * aligned. Adding shows a + before its label ("Post comment", "Log
 * update"); saving an edit says "Save". One bar, so the forms can't drift.
 */
export function InlineFormActions({
  submitLabel,
  isEditing = false,
  pending = false,
  disabled = false,
  disabledReason = null,
  submitType = 'button',
  onSubmit,
  onCancel,
}: {
  /** "Post comment", "Log update". */
  submitLabel: string
  /** Editing an existing record: the action reads "Save", no +. */
  isEditing?: boolean
  pending?: boolean
  disabled?: boolean
  disabledReason?: string | null
  /** 'submit' when the bar sits inside the form element. */
  submitType?: 'button' | 'submit'
  onSubmit?: () => void
  onCancel: () => void
}) {
  return (
    <div className='flex justify-end gap-2'>
      <Button
        type='button'
        variant='outline'
        onClick={onCancel}
        disabled={pending}
      >
        Cancel
      </Button>
      <DisabledFieldTooltip
        disabled={disabled && Boolean(disabledReason)}
        reason={disabledReason}
      >
        <Button
          type={submitType}
          onClick={submitType === 'button' ? onSubmit : undefined}
          disabled={disabled || pending}
        >
          {pending ? (
            <Loader2 className='animate-spin' />
          ) : isEditing ? null : (
            <Plus />
          )}
          {pending ? 'Saving…' : isEditing ? 'Save' : submitLabel}
        </Button>
      </DisabledFieldTooltip>
    </div>
  )
}
