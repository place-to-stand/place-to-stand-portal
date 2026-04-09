import type { Metadata } from 'next'
import { startOfMonth, endOfMonth, format, getMonth, getYear } from 'date-fns'

import { ArrowRight } from 'lucide-react'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { getLatestPartnerRates } from '@/lib/billing/partner-rates'
import { fetchMonthlyCloseReport } from '@/lib/data/reports/monthly-close'

import { BreakdownSheet } from './_components/breakdown-sheet'
import { CloserSection } from './_components/closer-section'
import { FormulaNotice } from './_components/formula-notice'
import { HouseSection } from './_components/house-section'
import { Net30Section } from './_components/net30-section'
import { OriginationSection } from './_components/origination-section'
import { PartnerPayoutsSection } from './_components/partner-payouts-section'
import { PayrollSection } from './_components/payroll-section'
import { PrepaidSection } from './_components/prepaid-section'
import { ReportHeader } from './_components/report-header'
import {
  BillingInCard,
  HoursLoggedCard,
  TotalPayoutsCard,
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

        {/* ─── Hero cards: left stack (Billing In + Work Billable) | right (Total Payouts) ── */}
        <div className='grid gap-4 lg:grid-cols-2'>
          <div className='flex flex-col gap-4'>
            <BillingInCard
              total={report.combinedBillingTotal}
              prepaidTotal={report.prepaidBilling.totalAmount}
              prepaidHours={report.prepaidBilling.totalHours}
              net30Total={report.net30Billing.totalAmount}
              net30Hours={report.net30Billing.totalHours}
              action={
                <BreakdownSheet
                  trigger={
                    <button className='text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-[11px] transition-colors'>
                      See breakdown <ArrowRight className='h-2.5 w-2.5' />
                    </button>
                  }
                  title='Billing Breakdown'
                  description='Prepaid hour block purchases and net 30 hours logged this month.'
                >
                  <PrepaidSection data={report.prepaidBilling} />
                  <Net30Section data={report.net30Billing} />
                </BreakdownSheet>
              }
            />
            <HoursLoggedCard hours={report.workBillableHours} />
          </div>
          <TotalPayoutsCard
            rates={report.rates}
            total={report.combinedPayoutTotal}
            payrollTotal={report.payroll.totalAmount}
            originationTotal={report.origination.totalAmount}
            closerTotal={report.closer.totalAmount}
            houseTotal={report.house.totalAmount}
            action={
              <BreakdownSheet
                trigger={
                  <button className='text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-[11px] transition-colors'>
                    See breakdown <ArrowRight className='h-2.5 w-2.5' />
                  </button>
                }
                title='Payout Breakdown'
                description='Payroll, origination, closer, and house breakdown this month.'
              >
                <PayrollSection data={report.payroll} />
                <OriginationSection data={report.origination} />
                {hasCloser ? <CloserSection data={report.closer} /> : null}
                <HouseSection
                  data={report.house}
                  nominalPercent={`${Math.round((report.rates.housePerHour / report.rates.billablePerHour) * 100)}%`}
                  prepaidHours={report.prepaidBilling.totalHours}
                  net30Hours={report.net30Billing.totalHours}
                />
              </BreakdownSheet>
            }
          />
        </div>

        <PartnerPayoutsSection data={report.partnerPayouts} />
      </div>
    </>
  )
}
