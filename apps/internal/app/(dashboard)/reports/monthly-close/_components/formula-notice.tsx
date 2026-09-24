'use client'

import { useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'

import { formatCalendarDate } from '@pts/ui/dates'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pts/ui/collapsible'
import type { PartnerRateSchedule } from '@/lib/billing/partner-rates'

type FormulaNoticeProps = {
  rates: PartnerRateSchedule
  latestRates: PartnerRateSchedule
}

function formatEffectiveDate(iso: string): string {
  return (
    formatCalendarDate(iso, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }) ?? iso
  )
}

function pct(part: number, whole: number): string {
  return `${Math.round((part / whole) * 100)}%`
}

function RateBreakdown({ rates }: { rates: PartnerRateSchedule }) {
  return (
    <div className='grid gap-x-8 gap-y-1 sm:grid-cols-2'>
      <div className='flex items-center justify-between gap-4 text-sm'>
        <span className='text-foreground/70'>Payroll</span>
        <span className='font-medium tabular-nums'>
          ${rates.payrollPerHour}/hr (
          {pct(rates.payrollPerHour, rates.billablePerHour)})
        </span>
      </div>
      <div className='flex items-center justify-between gap-4 text-sm'>
        <span className='text-foreground/70'>Closer</span>
        <span className='font-medium tabular-nums'>
          {rates.closerPerHour > 0
            ? `$${rates.closerPerHour}/hr (${pct(rates.closerPerHour, rates.billablePerHour)})`
            : 'Not active'}
        </span>
      </div>
      <div className='flex items-center justify-between gap-4 text-sm'>
        <span className='text-foreground/70'>Origination</span>
        <span className='font-medium tabular-nums'>
          ${rates.originationPerHour}/hr (
          {pct(rates.originationPerHour, rates.billablePerHour)})
        </span>
      </div>
      <div className='flex items-center justify-between gap-4 text-sm'>
        <span className='text-foreground/70'>House (est.)</span>
        <span className='font-medium tabular-nums'>
          ${rates.housePerHour}/hr (
          {pct(rates.housePerHour, rates.billablePerHour)})
        </span>
      </div>
      {!rates.internalOriginationPayable ? (
        <div className='text-foreground/50 col-span-full mt-1 text-xs'>
          Internal originators not paid this period (absorbed into house).
        </div>
      ) : null}
    </div>
  )
}

export function FormulaNotice({ rates, latestRates }: FormulaNoticeProps) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className='border-warning/30 bg-warning/10 rounded-xl border'>
        <CollapsibleTrigger className='focus-visible:ring-ring/50 flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-[3px]'>
          <Info className='text-warning size-4 shrink-0' />
          <div className='min-w-0 flex-1'>
            <p className='text-sm font-medium'>
              This month uses an older payout formula
            </p>
            <p className='text-muted-foreground text-xs'>
              Effective since {formatEffectiveDate(rates.effectiveFrom)}. The
              current formula took effect{' '}
              {formatEffectiveDate(latestRates.effectiveFrom)}.
            </p>
          </div>
          <ChevronDown
            className={cn(
              'text-warning size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
              open && 'rotate-180'
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className='border-warning/20 border-t px-4 pt-4 pb-4'>
            {/* This month's formula */}
            <div>
              <h4 className='text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase'>
                This month&apos;s formula (${rates.billablePerHour}/hr split)
              </h4>
              <RateBreakdown rates={rates} />
            </div>

            {/* Current formula for comparison */}
            <div className='border-warning/15 mt-4 border-t pt-4'>
              <h4 className='text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase'>
                Current formula (since{' '}
                {formatEffectiveDate(latestRates.effectiveFrom)})
              </h4>
              <RateBreakdown rates={latestRates} />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
