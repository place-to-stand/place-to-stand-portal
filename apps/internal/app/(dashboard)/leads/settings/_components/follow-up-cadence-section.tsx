'use client'

import { useCallback, useState, useTransition } from 'react'

import { Button } from '@pts/ui/button'
import { Label } from '@pts/ui/label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  LEAD_BOARD_COLUMNS,
  LEAD_STATUS_TOKENS,
  isTerminalLeadStatus,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import { LEAD_STALE_AFTER_DAYS } from '@/lib/leads/updates'
import type { LeadStageSettingRow } from '@/lib/queries/lead-stage-settings'

import { saveLeadStageSettings } from '../actions'

type FollowUpCadenceSectionProps = {
  initialThresholds: LeadStageSettingRow[]
}

const CONFIGURABLE_STAGES = LEAD_BOARD_COLUMNS.filter(
  column => !isTerminalLeadStatus(column.id)
)

const TERMINAL_STAGES = LEAD_BOARD_COLUMNS.filter(column =>
  isTerminalLeadStatus(column.id)
)

/**
 * Build the initial input values.
 *
 * A stage with no row falls back to `LEAD_STALE_AFTER_DAYS` so the form shows
 * what the board is actually doing, not an empty box that reads as "never"
 * (C14). An explicit null row stays empty — that stage really is never stale.
 */
function toFormValues(
  rows: LeadStageSettingRow[]
): Record<LeadStatusValue, string> {
  const configured = new Map(rows.map(row => [row.status, row.staleAfterDays]))

  return Object.fromEntries(
    CONFIGURABLE_STAGES.map(stage => {
      const value = configured.has(stage.id)
        ? configured.get(stage.id)
        : LEAD_STALE_AFTER_DAYS[stage.id]

      return [stage.id, value == null ? '' : String(value)]
    })
  ) as Record<LeadStatusValue, string>
}

export function FollowUpCadenceSection({
  initialThresholds,
}: FollowUpCadenceSectionProps) {
  const [values, setValues] = useState(() => toFormValues(initialThresholds))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleChange = useCallback((status: LeadStatusValue, next: string) => {
    setValues(prev => ({ ...prev, [status]: next }))
    setSaved(false)
    setError(null)
  }, [])

  const handleSave = useCallback(() => {
    setError(null)

    const payload = CONFIGURABLE_STAGES.map(stage => {
      const raw = values[stage.id]?.trim() ?? ''
      return {
        status: stage.id,
        staleAfterDays: raw === '' ? null : Number(raw),
      }
    })

    const invalid = payload.find(
      entry =>
        entry.staleAfterDays !== null &&
        !Number.isInteger(entry.staleAfterDays)
    )

    if (invalid) {
      setError('Enter a whole number of days, or leave a stage blank for never.')
      return
    }

    startTransition(async () => {
      const result = await saveLeadStageSettings(payload)

      if (result.ok) {
        setSaved(true)
        return
      }

      setError(result.error)
    })
  }, [values])

  return (
    <section className='space-y-4'>
      <div>
        <h2 className='text-lg font-semibold'>Follow-up cadence</h2>
        <p className='text-muted-foreground mt-1 text-sm'>
          Mark a lead as needing follow-up after this many days without a logged
          meeting, call, or email. Notes don&apos;t count. Leave a stage blank to
          never flag it.
        </p>
      </div>

      <div className='space-y-3'>
        {CONFIGURABLE_STAGES.map(stage => (
          <div
            key={stage.id}
            className='flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3'
          >
            <div className='min-w-0'>
              <Badge className={LEAD_STATUS_TOKENS[stage.id]}>
                {stage.label}
              </Badge>
              <p className='text-muted-foreground mt-1 text-xs'>
                {stage.description}
              </p>
            </div>

            <div className='flex shrink-0 items-center gap-2'>
              <Label
                htmlFor={`stale-after-${stage.id}`}
                className='text-muted-foreground text-xs'
              >
                Days
              </Label>
              <Input
                id={`stale-after-${stage.id}`}
                type='number'
                inputMode='numeric'
                min={1}
                max={365}
                className='w-24'
                placeholder='Never'
                value={values[stage.id] ?? ''}
                onChange={event => handleChange(stage.id, event.target.value)}
              />
            </div>
          </div>
        ))}

        {TERMINAL_STAGES.map(stage => (
          <div
            key={stage.id}
            className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3'
          >
            <div className='min-w-0'>
              <Badge className={LEAD_STATUS_TOKENS[stage.id]}>
                {stage.label}
              </Badge>
              <p className='text-muted-foreground mt-1 text-xs'>
                {stage.description}
              </p>
            </div>
            <span className='text-muted-foreground shrink-0 text-sm'>Never</span>
          </div>
        ))}
      </div>

      <div className='flex items-center gap-3'>
        {/* Save is never gated on dirty state — only on an in-flight save. */}
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save cadence'}
        </Button>
        {error ? (
          <p role='alert' className='text-destructive text-sm'>
            {error}
          </p>
        ) : null}
        {saved && !error ? (
          <p role='status' className='text-muted-foreground text-sm'>
            Saved.
          </p>
        ) : null}
      </div>
    </section>
  )
}
