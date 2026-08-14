'use client'

import { useCallback, useState, useTransition } from 'react'

import { Button } from '@pts/ui/button'
import { Checkbox } from '@pts/ui/checkbox'
import { Label } from '@pts/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  LEAD_UPDATE_LABELS,
  LEAD_UPDATE_TYPES,
  type LeadUpdateTypeValue,
} from '@/lib/leads/updates'

import { createLeadUpdate } from '../../../_actions/updates/create-lead-update'

type LeadUpdateComposerProps = {
  leadId: string
  /** Days until this lead's stage goes stale; drives the D24 due-date prefill. */
  staleAfterDays: number | null
  onCancel: () => void
  onSaved: (options: { addFollowUpTask: boolean; dueOn: string | null }) => void
}

/** `YYYY-MM-DD` in local time — what a `<input type="date">` expects. */
function toDateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function defaultFollowUpDate(staleAfterDays: number | null): string {
  if (staleAfterDays === null) {
    return ''
  }

  const due = new Date()
  due.setDate(due.getDate() + staleAfterDays)
  return toDateInputValue(due)
}

export function LeadUpdateComposer({
  leadId,
  staleAfterDays,
  onCancel,
  onSaved,
}: LeadUpdateComposerProps) {
  const [type, setType] = useState<LeadUpdateTypeValue>('PHONE_CALL')
  const [body, setBody] = useState('')
  const [occurredOn, setOccurredOn] = useState(() =>
    toDateInputValue(new Date())
  )
  const [addFollowUpTask, setAddFollowUpTask] = useState(false)
  // Sourced from the same configured threshold the staleness dot uses, so the
  // follow-up lands on the day the lead would otherwise go stale (D24).
  const [followUpDue, setFollowUpDue] = useState(() =>
    defaultFollowUpDate(staleAfterDays)
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = useCallback(() => {
    setError(null)

    startTransition(async () => {
      const result = await createLeadUpdate({
        leadId,
        type,
        body,
        // Anchor the chosen calendar day at local noon so a timezone shift can
        // never roll it into "tomorrow" and trip the no-future-dates guard.
        occurredAt: new Date(`${occurredOn}T12:00:00`).toISOString(),
      })

      if (!result.success) {
        setError(result.error ?? 'Unable to log update.')
        return
      }

      // Save = done = close. The follow-up capture opens only after a
      // SUCCESSFUL save — never on failure (D21).
      onSaved({
        addFollowUpTask,
        dueOn: addFollowUpTask && followUpDue ? followUpDue : null,
      })
    })
  }, [
    addFollowUpTask,
    body,
    followUpDue,
    leadId,
    occurredOn,
    onSaved,
    type,
  ])

  return (
    <div className='space-y-3 rounded-lg border p-3'>
      <div className='flex gap-2'>
        <div className='flex-1 space-y-1'>
          <Label htmlFor='lead-update-type' className='text-xs'>
            Type
          </Label>
          <Select
            value={type}
            onValueChange={value => setType(value as LeadUpdateTypeValue)}
          >
            <SelectTrigger id='lead-update-type' size='sm'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_UPDATE_TYPES.map(value => (
                <SelectItem key={value} value={value}>
                  {LEAD_UPDATE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='flex-1 space-y-1'>
          <Label htmlFor='lead-update-date' className='text-xs'>
            Date
          </Label>
          <Input
            id='lead-update-date'
            type='date'
            max={toDateInputValue(new Date())}
            value={occurredOn}
            onChange={event => setOccurredOn(event.target.value)}
          />
        </div>
      </div>

      <div className='space-y-1'>
        <Label htmlFor='lead-update-body' className='text-xs'>
          What happened
        </Label>
        <Textarea
          id='lead-update-body'
          rows={3}
          maxLength={5000}
          value={body}
          onChange={event => setBody(event.target.value)}
          placeholder='Discussed scope and timeline…'
        />
      </div>

      <div className='space-y-2'>
        <div className='flex items-center gap-2'>
          <Checkbox
            id='lead-update-follow-up'
            checked={addFollowUpTask}
            onCheckedChange={checked => setAddFollowUpTask(checked === true)}
          />
          <Label htmlFor='lead-update-follow-up' className='text-xs font-normal'>
            Add follow-up task
          </Label>
        </div>
        {addFollowUpTask ? (
          <div className='space-y-1 pl-6'>
            <Label htmlFor='lead-update-follow-up-due' className='text-xs'>
              Due
            </Label>
            <Input
              id='lead-update-follow-up-due'
              type='date'
              value={followUpDue}
              onChange={event => setFollowUpDue(event.target.value)}
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <p role='alert' className='text-destructive text-xs'>
          {error}
        </p>
      ) : null}

      <div className='flex justify-end gap-2'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        {/* Never gated on dirty state — only on an in-flight save. */}
        <Button
          type='button'
          size='sm'
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? 'Saving…' : 'Log update'}
        </Button>
      </div>
    </div>
  )
}
