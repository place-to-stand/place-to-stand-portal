import type { Metadata } from 'next'
import { getMonth, getYear } from 'date-fns'

import { formatCalendarDate } from '@pts/ui/dates'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireRole } from '@/lib/auth/session'
import {
  getLatestPartnerRates,
  getPartnerRatesEndDate,
} from '@/lib/billing/partner-rates'
import { fetchMonthlyCloseView } from '@/lib/data/reports/close'

import { BillingInCard } from './_components/billing-in-card'
import { CloseControls } from './_components/close-controls'
import { DriftNotice } from './_components/drift-notice'
import { FormulaNotice } from './_components/formula-notice'
import { PartnerPayoutsTable } from './_components/partner-payouts-table'
import { buildPayoutTable } from './_components/payout-rows'
import { ProfitShareCard } from './_components/profit-share-card'
import { RateSplitCard } from './_components/rate-split-card'
import { ReportToolbar } from './_components/report-toolbar'
import { SnapshotErrorNotice } from './_components/snapshot-error-notice'
import { SummaryStrip } from './_components/summary-strip'

export const metadata: Metadata = {
  title: 'Monthly close | Reports',
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

  // Month is 0-indexed in the URL (0 = January, 11 = December).
  const now = new Date()
  const monthParam = parseSearchParam(params.month)
  const yearParam = parseSearchParam(params.year)

  const parsedMonth = monthParam ? parseInt(monthParam, 10) : getMonth(now)
  const parsedYear = yearParam ? parseInt(yearParam, 10) : getYear(now)

  const validMonth =
    Number.isFinite(parsedMonth) && parsedMonth >= 0 && parsedMonth <= 11
      ? parsedMonth
      : getMonth(now)
  const validYear = Number.isFinite(parsedYear) ? parsedYear : getYear(now)

  // W4: the URL month param is 0-indexed; the close layer is 1-indexed.
  const closeMonthNumber = validMonth + 1
  const monthKey = `${validYear}-${String(closeMonthNumber).padStart(2, '0')}`

  const { report, close, profitShare } = await fetchMonthlyCloseView(
    validYear,
    closeMonthNumber
  )

  // Date-only strings format in UTC, so labels never drift a month.
  const displayMonth =
    formatCalendarDate(`${monthKey}-01`, { month: 'long', year: 'numeric' }) ??
    ''
  const monthName =
    formatCalendarDate(`${monthKey}-01`, { month: 'long' }) ?? ''
  const lastDay = new Date(
    Date.UTC(validYear, closeMonthNumber, 0)
  ).getUTCDate()
  const lastDayLabel =
    formatCalendarDate(`${monthKey}-${String(lastDay).padStart(2, '0')}`, {
      month: 'short',
      day: 'numeric',
    }) ?? ''

  const isCurrentMonth =
    validYear === getYear(now) && validMonth === getMonth(now)
  const inProgress = isCurrentMonth && close.status === 'open'

  const latestRates = getLatestPartnerRates()
  const isOlderFormula =
    report.rates.effectiveFrom !== latestRates.effectiveFrom

  const profitShareData =
    profitShare.status === 'ready' ? profitShare.data : null
  const payoutTable = buildPayoutTable(report, profitShareData)

  const detailCards = (
    <>
      <BillingInCard
        prepaid={report.prepaidBilling}
        net30={report.net30Billing}
        total={report.combinedBillingTotal}
      />
      <RateSplitCard report={report} />
    </>
  )

  return (
    <PageShell breadcrumbs={crumbsForNav('/reports/monthly-close')}>
      <div className='space-y-6'>
        <ReportToolbar
          minCursor={report.minCursor}
          maxCursor={report.maxCursor}
          today={{ year: getYear(now), month: getMonth(now) + 1 }}
          status={close.status}
          isCurrentMonth={isCurrentMonth}
          closedAt={close.closedAt}
          closedByName={close.closedByName}
          closesAfterLabel={`You can close ${monthName} after ${lastDayLabel}.`}
          closeControls={
            <CloseControls
              year={validYear}
              month={closeMonthNumber}
              displayMonth={displayMonth}
              status={close.status}
              payoutsTotal={report.partnerPayouts.totalAmount}
              profitShare={profitShare}
            />
          }
        />

        {close.snapshotError ? (
          <SnapshotErrorNotice message={close.snapshotError} />
        ) : null}

        {close.status === 'closed' && close.drift?.hasDrift ? (
          <DriftNotice
            year={validYear}
            month={closeMonthNumber}
            displayMonth={displayMonth}
            drift={close.drift}
          />
        ) : null}

        {isOlderFormula ? (
          <FormulaNotice
            displayMonth={displayMonth}
            rates={report.rates}
            latestRates={latestRates}
            endsOn={getPartnerRatesEndDate(report.rates)}
          />
        ) : null}

        <SummaryStrip
          report={report}
          profitShare={profitShare}
          inProgress={inProgress}
        />

        <PartnerPayoutsTable
          table={payoutTable}
          showCloser={
            report.rates.closerPerHour > 0 ||
            report.partnerPayouts.totalCloser > 0
          }
          showProfitShare={profitShareData !== null}
        />

        <div className='grid items-start gap-6 lg:grid-cols-2'>
          {profitShare.status === 'inactive' ? (
            detailCards
          ) : (
            <>
              <ProfitShareCard
                state={profitShare}
                year={validYear}
                month={closeMonthNumber}
                displayMonth={displayMonth}
                lastDayLabel={lastDayLabel}
              />
              <div className='space-y-6'>{detailCards}</div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  )
}
