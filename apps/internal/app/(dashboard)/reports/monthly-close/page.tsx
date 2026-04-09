import type { Metadata } from 'next'
import { startOfMonth, endOfMonth, format, getMonth, getYear } from 'date-fns'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { getLatestPartnerRates } from '@/lib/billing/partner-rates'
import { fetchMonthlyCloseReport } from '@/lib/data/reports/monthly-close'

import { CloserSection } from './_components/closer-section'
import { FormulaNotice } from './_components/formula-notice'
import { Net30Section } from './_components/net30-section'
import { OriginationSection } from './_components/origination-section'
import { PartnerPayoutsSection } from './_components/partner-payouts-section'
import { PayrollSection } from './_components/payroll-section'
import { PrepaidSection } from './_components/prepaid-section'
import { ReportHeader } from './_components/report-header'
import {
  BillingInCard,
  HouseCard,
  TotalPayoutsCard,
  WorkBillableCard,
  housePercentFromRates,
} from './_components/summary-cards'

export const metadata: Metadata = {
  title: 'Monthly Close | Reports',
}

type MonthlyClosePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function parseSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value[0] ?? null
  return null
}

export default async function MonthlyClosePage({
  searchParams,
}: MonthlyClosePageProps) {
  await requireRole('ADMIN')

  const params = searchParams ? await searchParams : {}

  // Parse month and year from URL params
  // Month is 0-indexed (0 = January, 11 = December)
  const now = new Date()
  const monthParam = parseSearchParam(params.month)
  const yearParam = parseSearchParam(params.year)

  const parsedMonth = monthParam ? parseInt(monthParam, 10) : getMonth(now)
  const parsedYear = yearParam ? parseInt(yearParam, 10) : getYear(now)

  // Validate and default to current month if invalid
  const validMonth =
    Number.isFinite(parsedMonth) && parsedMonth >= 0 && parsedMonth <= 11
      ? parsedMonth
      : getMonth(now)
  const validYear = Number.isFinite(parsedYear) ? parsedYear : getYear(now)

  // Create Date object and calculate date range using date-fns
  const selectedMonth = new Date(validYear, validMonth, 1)
  const startDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd')
  const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd')

  // Fetch report data
  const report = await fetchMonthlyCloseReport(startDate, endDate)

  // Format month for display
  const displayMonth = format(selectedMonth, 'MMMM yyyy')

  // Hide the closer section + column entirely when the period pre-dates the
  // closer cutover (closerPerHour === 0).
  const hasCloser = report.rates.closerPerHour > 0

  const latestRates = getLatestPartnerRates()
  const isOlderFormula =
    report.rates.effectiveFrom !== latestRates.effectiveFrom

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Monthly Close Report
          </h1>
          <p className='text-muted-foreground text-sm'>
            End-of-month reconciliation for billing, payroll, origination, and
            closer commissions.
          </p>
        </div>
      </AppShellHeader>

      <div className='space-y-8'>
        <ReportHeader
          displayMonth={displayMonth}
          minCursor={report.minCursor}
          maxCursor={report.maxCursor}
        />

        {isOlderFormula ? (
          <FormulaNotice rates={report.rates} latestRates={latestRates} />
        ) : null}

        {/* ─── Ledger layout: money in (left) ┃ money out (right) ── */}
        <div className='grid gap-8 lg:grid-cols-2'>
          {/* Left column — money in + derived value */}
          <div className='space-y-3'>
            <BillingInCard
              total={report.combinedBillingTotal}
              prepaidTotal={report.prepaidBilling.totalAmount}
              net30Total={report.net30Billing.totalAmount}
            />
            <div className='grid gap-3 sm:grid-cols-2'>
              <WorkBillableCard
                total={report.workBillableTotal}
                hours={report.workBillableHours}
                billablePerHour={report.rates.billablePerHour}
              />
              <HouseCard
                total={report.house.totalAmount}
                nominalPercent={housePercentFromRates(report.rates)}
                ratePerHour={report.rates.housePerHour}
              />
            </div>
            <PrepaidSection data={report.prepaidBilling} />
            <Net30Section data={report.net30Billing} />
          </div>

          {/* Right column — money out */}
          <div className='space-y-3'>
            <TotalPayoutsCard
              rates={report.rates}
              total={report.combinedPayoutTotal}
              payrollTotal={report.payroll.totalAmount}
              originationTotal={report.origination.totalAmount}
              closerTotal={report.closer.totalAmount}
            />
            <PayrollSection data={report.payroll} />
            <OriginationSection data={report.origination} />
            {hasCloser ? <CloserSection data={report.closer} /> : null}
          </div>
        </div>

        {/* Full-width action footer: the lump-sum payment sheet */}
        <PartnerPayoutsSection data={report.partnerPayouts} />
      </div>
    </>
  )
}
