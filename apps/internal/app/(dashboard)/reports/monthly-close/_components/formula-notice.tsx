'use client'

import { useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pts/ui/collapsible'
import { formatCalendarDate } from '@pts/ui/dates'
import type { PartnerRateSchedule } from '@/lib/billing/partner-rates'
import { cn } from '@/lib/utils'

import { formatPercent } from './format'

type FormulaNoticeProps = {
  displayMonth: string
  rates: PartnerRateSchedule
  latestRates: PartnerRateSchedule
  /** Last day this month's formula applied (the day before the next one). */
  endsOn: string | null
}

function day(iso: string): string {
  return (
    formatCalendarDate(iso, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) ?? iso
  )
}

function rateLabel(perHour: number, billable: number): string {
  return perHour > 0
    ? `$${perHour}/hr · ${formatPercent(perHour, billable)}`
    : 'Not active'
}

/**
 * Shown on a month priced by an older rate schedule. Informational, not a
 * warning: the older formula is correct for the month.
 */
export function FormulaNotice({
  displayMonth,
  rates,
  latestRates,
  endsOn,
}: FormulaNoticeProps) {
  const [open, setOpen] = useState(false)

  const rows: Array<{ label: string; month: string; current: string }> = [
    {
      label: 'Payroll',
      month: rateLabel(rates.payrollPerHour, rates.billablePerHour),
      current: rateLabel(
        latestRates.payrollPerHour,
        latestRates.billablePerHour
      ),
    },
    {
      label: 'Closer',
      month: rateLabel(rates.closerPerHour, rates.billablePerHour),
      current: rateLabel(
        latestRates.closerPerHour,
        latestRates.billablePerHour
      ),
    },
    {
      label: 'Origination',
      month: `${rateLabel(rates.originationPerHour, rates.billablePerHour)}${rates.internalOriginationPayable ? '' : ', external only'}`,
      current: rateLabel(
        latestRates.originationPerHour,
        latestRates.billablePerHour
      ),
    },
    {
      label: 'House (est.)',
      month: rateLabel(rates.housePerHour, rates.billablePerHour),
      current: rateLabel(latestRates.housePerHour, latestRates.billablePerHour),
    },
  ]

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className='bg-card overflow-hidden rounded-xl border shadow-sm'
    >
      <CollapsibleTrigger className='focus-visible:ring-ring/50 flex w-full cursor-pointer items-center gap-2.5 px-5 py-3.5 text-left outline-none focus-visible:ring-[3px]'>
        <Info className='text-muted-foreground size-4 shrink-0' />
        <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <span className='text-sm font-semibold'>
            {displayMonth} uses an older payout formula
          </span>
          <span className='text-muted-foreground text-[13px]'>
            In effect {day(rates.effectiveFrom)}
            {endsOn ? ` to ${day(endsOn)}` : ''}. The current formula started{' '}
            {day(latestRates.effectiveFrom)}.
          </span>
        </span>
        <ChevronDown
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
            open && 'rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <table className='w-full table-fixed border-t text-sm'>
          <thead>
            <tr className='bg-muted/50 border-b'>
              <th className='text-muted-foreground h-8 pr-2 pl-11 text-left text-xs font-medium'>
                Share of ${rates.billablePerHour}/hr
              </th>
              <th className='text-muted-foreground w-56 px-2 text-right text-xs font-medium'>
                {displayMonth}
              </th>
              <th className='text-muted-foreground w-56 pr-5 pl-2 text-right text-xs font-medium'>
                Current, since {day(latestRates.effectiveFrom)}
              </th>
            </tr>
          </thead>
          <tbody className='divide-border/50 divide-y'>
            {rows.map(row => (
              <tr key={row.label}>
                <th
                  scope='row'
                  className='py-2 pr-2 pl-11 text-left font-normal'
                >
                  {row.label}
                </th>
                <td className='px-2 py-2 text-right font-medium tabular-nums'>
                  {row.month}
                </td>
                <td className='text-muted-foreground py-2 pr-5 pl-2 text-right tabular-nums'>
                  {row.current}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rates.internalOriginationPayable ? (
          <p className='bg-muted/50 text-muted-foreground border-t py-3 pr-5 pl-11 text-xs'>
            Internal originators weren&apos;t paid this period, so their share
            stayed in house.
          </p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
