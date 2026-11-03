'use client'

import { useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pts/ui/collapsible'
import { formatCalendarDate } from '@pts/ui/dates'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import type { PartnerRateSchedule } from '@/lib/billing/partner-rates'
import { cn } from '@/lib/utils'

import { formatShare } from './format'
import { formatCurrency } from '@pts/ui/numbers'
import { pagePanelClass } from '@/components/layout/page-panel'

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
    ? `${formatCurrency(perHour)}/hr · ${formatShare(perHour, billable)}`
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
      className={cn(pagePanelClass, 'overflow-hidden')}
    >
      <CollapsibleTrigger className='focus-visible:ring-ring/50 flex w-full cursor-pointer items-center gap-2.5 px-5 py-3.5 text-left outline-none focus-visible:ring-[3px]'>
        <Info className='text-muted-foreground size-4 shrink-0' />
        <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <span className='text-sm font-semibold'>
            {displayMonth} uses an older payout formula
          </span>
          <span className='text-muted-foreground text-sm'>
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
        <Table density='compact' className='table-fixed border-t'>
          <TableHeader>
            <TableRow className='bg-muted/50 hover:bg-muted/50'>
              <TableHead className='text-muted-foreground pl-11 text-xs font-medium'>
                Share of {formatCurrency(rates.billablePerHour)}/hr
              </TableHead>
              <TableHead className='text-muted-foreground w-56 text-right text-xs font-medium'>
                {displayMonth}
              </TableHead>
              <TableHead className='text-muted-foreground w-56 pr-5 text-right text-xs font-medium'>
                Current, since {day(latestRates.effectiveFrom)}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.label}>
                <TableCell className='pl-11 whitespace-normal'>
                  {row.label}
                </TableCell>
                <TableCell className='text-right font-medium tabular-nums'>
                  {row.month}
                </TableCell>
                <TableCell className='text-muted-foreground pr-5 text-right tabular-nums'>
                  {row.current}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
