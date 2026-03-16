import type { Metadata } from 'next'
import { startOfMonth, endOfMonth, format, getMonth, getYear } from 'date-fns'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { fetchMonthlyCloseReport } from '@/lib/data/reports/monthly-close'

import { ReportHeader } from './_components/report-header'
import { ReportSummary } from './_components/report-summary'
import { PayrollSection } from './_components/payroll-section'
import { ReferralsSection } from './_components/referrals-section'
import { Net30Section } from './_components/net30-section'

export const metadata: Metadata = {
  title: 'Monthly Close | Reports',
}

type MonthlyClosePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function parseSearchParam(
  value: string | string[] | undefined
): string | null {
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

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Monthly Close Report
          </h1>
          <p className='text-muted-foreground text-sm'>
            End-of-month financial reconciliation for payroll, referrals, and
            billing.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-6'>
        <ReportHeader
          displayMonth={displayMonth}
          minCursor={report.minCursor}
          maxCursor={report.maxCursor}
        />

        <ReportSummary
          prepaidTotal={report.prepaidBilling.totalAmount}
          net30Total={report.net30Billing.totalAmount}
          payrollTotal={report.payroll.totalAmount}
          referralsTotal={report.referrals.totalAmount}
        />

        <div className='space-y-6'>
          <Net30Section data={report.net30Billing} />
          <PayrollSection data={report.payroll} />
          <ReferralsSection data={report.referrals} />
        </div>
      </div>
    </>
  )
}
