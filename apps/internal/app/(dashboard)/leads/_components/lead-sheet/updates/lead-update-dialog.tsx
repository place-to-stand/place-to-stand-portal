'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { Label } from '@pts/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { InlineReveal } from '@/components/ui/inline-reveal'
import { LeadUpdateTypeBadge } from './lead-update-type-badge'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { useToast } from '@/components/ui/use-toast'
import {
  isContentEmpty,
  sanitizeEditorHtml,
} from '@/components/ui/rich-text-editor/utils'
import { toCalendarDate } from '@/lib/dates/calendar-date'
import type { LeadUpdateRecord } from '@/lib/leads/types'
import {
  LEAD_UPDATE_TYPES,
  type LeadUpdateTypeValue,
} from '@/lib/leads/updates'

import { createLeadUpdate } from '../../../_actions/updates/create-lead-update'
import { updateLeadUpdate } from '../../../_actions/updates/update-lead-update'

type LeadUpdateDialogProps = {
  leadId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present = edit that update; null = log a new one. */
  update: LeadUpdateRecord | null
  onSaved: () => void
  /** Bumped by the section's X: close like Cancel (asks first if edited). */
  closeRequest?: number
}

/**
 * Today gets the ACTUAL current time — anchoring today at local noon would be
 * a future timestamp for anyone logging in the morning, and the server's
 * no-future-dates guard would (rightly) reject it. Past days keep the noon
 * anchor so a timezone shift can never roll them into "tomorrow" and trip
 * that same guard.
 */
function toOccurredAt(occurredOn: string): string {
  const now = new Date()
  return (
    occurredOn === toCalendarDate(now)
      ? now
      : new Date(`${occurredOn}T12:00:00`)
  ).toISOString()
}

export function LeadUpdateDialog({
  leadId,
  open,
  onOpenChange,
  update,
  onSaved,
  closeRequest = 0,
}: LeadUpdateDialogProps) {
  const isEditing = update !== null
  const [type, setType] = useState<LeadUpdateTypeValue>('PHONE_CALL')
  const [body, setBody] = useState('')
  const [occurredOn, setOccurredOn] = useState(() => toCalendarDate(new Date()))
  // Only the empty-body check shows here, on the field; save results toast.
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  // Any user edit arms the discard guard. The RTE's onChange only fires on
  // user transactions (external value syncs use setContent without emitting),
  // so this never trips on the dialog seeding its own fields.
  const [isDirty, setIsDirty] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Re-seed the form each time the dialog opens (or switches target update):
  // prefilled from the update being edited, or reset to a fresh "log it now"
  // state. Adjust-during-render rather than an effect, so React restarts the
  // render immediately instead of painting a stale frame first — the same
  // pattern the task sheet uses for its planning-panel reset.
  const seedKey = open ? (update?.id ?? 'new') : null
  const [prevSeedKey, setPrevSeedKey] = useState<string | null>(null)
  if (seedKey !== prevSeedKey) {
    setPrevSeedKey(seedKey)
    if (seedKey !== null) {
      setType(update?.type ?? 'PHONE_CALL')
      setBody(update?.body ?? '')
      setOccurredOn(
        toCalendarDate(update ? new Date(update.occurredAt) : new Date())
      )
      setError(null)
      setIsDirty(false)
      setShowDiscardConfirm(false)
    }
  }

  // Esc, backdrop click, and Cancel all route through here. With edits in
  // flight, closing needs an explicit "Discard" — otherwise a stray outside
  // click silently eats a half-written update.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && isDirty) {
        setShowDiscardConfirm(true)
        return
      }

      onOpenChange(next)
    },
    [isDirty, onOpenChange]
  )

  // The section's X asks to close, like Cancel.
  const lastCloseRequest = useRef(closeRequest)
  useEffect(() => {
    if (closeRequest === lastCloseRequest.current) return
    lastCloseRequest.current = closeRequest
    handleOpenChange(false)
  }, [closeRequest, handleOpenChange])

  const handleSubmit = useCallback(() => {
    setError(null)

    // Same treatment task comments give the editor's output: sanitize before
    // send, and refuse a body that is only empty markup.
    const sanitizedBody = sanitizeEditorHtml(body)

    if (isContentEmpty(sanitizedBody)) {
      setError('Add a short description of the interaction.')
      return
    }

    startTransition(async () => {
      const payload = {
        leadId,
        type,
        body: sanitizedBody,
        occurredAt: toOccurredAt(occurredOn),
      }

      const result = update
        ? await updateLeadUpdate({ ...payload, id: update.id })
        : await createLeadUpdate(payload)

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: isEditing ? 'Unable to save update' : 'Unable to log update',
          description: result.error ?? 'Please try again.',
        })
        return
      }

      toast({ title: isEditing ? 'Update saved' : 'Update logged' })

      // Save = done = close (project convention: task-sheet-closes-on-save).
      // Saved edits are no longer discardable, so close directly.
      setIsDirty(false)
      onSaved()
      onOpenChange(false)
    })
  }, [
    body,
    isEditing,
    leadId,
    occurredOn,
    onOpenChange,
    onSaved,
    toast,
    type,
    update,
  ])

  return (
    <>
      {/* Inline in the Updates section (EntityList's inlineForm), under the
          heading: no dialog over the lead sheet. It eases open and closed so
          the list below doesn't jump; pb-2 is its 8px over the list. */}
      <InlineReveal open={open}>
        <div className='pb-2'>
          <div className='bg-card space-y-4 rounded-lg border p-3'>
            <p className='text-sm font-medium'>
              {isEditing ? 'Edit update' : 'Log update'}
            </p>

            {/* min-w-0 lets this grid child shrink to the popup's width — without
            it the RTE toolbar's min-content width drags the whole track wider
            than the panel and everything bleeds past the border. */}
            <div className='min-w-0 space-y-4'>
              <div className='flex gap-3'>
                <div className='flex-1 space-y-1'>
                  <Label htmlFor='lead-update-type' className='text-xs'>
                    Type
                  </Label>
                  <Select
                    value={type}
                    onValueChange={value => {
                      setType(value as LeadUpdateTypeValue)
                      setIsDirty(true)
                    }}
                  >
                    <SelectTrigger id='lead-update-type'>
                      <SelectValue>
                        <LeadUpdateTypeBadge type={type} />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_UPDATE_TYPES.map(value => (
                        <SelectItem key={value} value={value}>
                          <LeadUpdateTypeBadge type={value} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='flex-1 space-y-1'>
                  <Label htmlFor='lead-update-date' className='text-xs'>
                    Date
                  </Label>
                  <DatePicker
                    id='lead-update-date'
                    max={toCalendarDate(new Date())}
                    value={occurredOn}
                    clearable={false}
                    onChange={value => {
                      setOccurredOn(value)
                      setIsDirty(true)
                    }}
                  />
                </div>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='lead-update-body' className='text-xs'>
                  What happened
                </Label>
                <RichTextEditor
                  id='lead-update-body'
                  value={body}
                  onChange={value => {
                    setBody(value)
                    setIsDirty(true)
                  }}
                  placeholder='Discussed scope and timeline…'
                  contentMinHeightClassName='[&_.ProseMirror]:min-h-[180px]'
                />
              </div>

              {error ? (
                <p role='alert' className='text-destructive text-xs'>
                  {error}
                </p>
              ) : null}
            </div>

            <div className='flex justify-end gap-2'>
              <Button
                type='button'
                variant='ghost'
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              {/* Never gated on dirty state — only on an in-flight save. */}
              <Button type='button' onClick={handleSubmit} disabled={isPending}>
                {isPending ? 'Saving…' : isEditing ? 'Save' : 'Log'}
              </Button>
            </div>
          </div>
        </div>
      </InlineReveal>

      <ConfirmDialog
        open={showDiscardConfirm}
        title='Discard this update?'
        description="Your changes haven't been saved."
        confirmLabel='Discard'
        confirmVariant='destructive'
        onConfirm={() => {
          setShowDiscardConfirm(false)
          setIsDirty(false)
          onOpenChange(false)
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </>
  )
}
