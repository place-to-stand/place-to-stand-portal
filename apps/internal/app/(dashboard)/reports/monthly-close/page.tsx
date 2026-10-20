import type { Metadata } from 'next'
import { Suspense } from 'react'
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
import { loadStripeFees } from '@/lib/stripe/fees'

import { BillingInCard } from './_components/billing-in-card'
import { CloseControls } from './_components/close-controls'
import { FormulaNotice } from './_components/formula-notice'
import { PartnerPayoutsTable } from './_components/partner-payouts-table'
import { buildPayoutTable } from './_components/payout-rows'
import { ProfitShareCard } from './_components/profit-share-card'
import { RateSplitCard } from './_components/rate-split-card'
import {
  ReportBody,
  ReportNavigationProvider,
} from './_components/report-navigation'
import { ReportToolbar } from './_components/report-toolbar'
import { SalesTaxCard } from './_components/sales-tax-card'
import {
  StreamedDriftNotice,
  StreamedStripeFeesCard,
  StripeFeesCardSkeleton,
} from './_components/streamed'
import { SnapshotErrorNotice } from './_components/snapshot-error-notice'
import { SummaryStrip } from './_components/summary-strip'

export const metadata: Metadata = {
  title: 'Monthly close | Reports',
}

function parseSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value[0] ?? null
  return null
}

export default async function MonthlyClosePage({
  searchParams,
}: PageProps<'/reports/monthly-close'>) {
  await requireRole('ADMIN')

  const params = await searchParams

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

  // Started before the report is awaited so the round trip overlaps the
  // database reads; the card streams in when Stripe answers.
  const stripeFees = loadStripeFees(validYear, closeMonthNumber)
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

  const entryDateLabel =
    formatCalendarDate(`${monthKey}-${String(lastDay).padStart(2, '0')}`) ?? ''
  const shortMonthLabel =
    formatCalendarDate(`${monthKey}-01`, { month: 'short', year: 'numeric' }) ??
    ''

  const isCurrentMonth =
    validYear === getYear(now) && validMonth === getMonth(now)
  const inProgress = isCurrentMonth && close.status === 'open'

  const latestRates = getLatestPartnerRates()
  const isOlderFormula =
    report.rates.effectiveFrom !== latestRates.effectiveFrom

  const profitShareData =
    profitShare.status === 'ready' ? profitShare.data : null
  const payoutTable = buildPayoutTable(report, profitShareData)

  const billingInCard = (
    <BillingInCard
      prepaid={report.prepaidBilling}
      net30={report.net30Billing}
      total={report.combinedBillingTotal}
    />
  )
  const bookkeepingCards = (
    <>
      <SalesTaxCard salesTax={report.salesTax} isLive={close.salesTaxIsLive} />
      {/* Keyed by month: a new boundary shows its skeleton at once, where a
          reused one would hold the whole month switch until Stripe answers. */}
      <Suspense key={monthKey} fallback={<StripeFeesCardSkeleton />}>
        <StreamedStripeFeesCard
          state={stripeFees}
          entryDate={entryDateLabel}
          monthLabel={shortMonthLabel}
          inProgress={isCurrentMonth}
        />
      </Suspense>
    </>
  )
  const rateSplitCard = <RateSplitCard report={report} />

  return (
    <PageShell breadcrumbs={crumbsForNav('/reports/monthly-close')}>
      <ReportNavigationProvider
        minCursor={report.minCursor}
        maxCursor={report.maxCursor}
      >
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
          <ReportBody>
            {close.snapshotError ? (
              <SnapshotErrorNotice message={close.snapshotError} />
            ) : null}

            {close.status === 'closed' && close.drift ? (
              <Suspense key={monthKey} fallback={null}>
                <StreamedDriftNotice
                  year={validYear}
                  month={closeMonthNumber}
                  displayMonth={displayMonth}
                  drift={close.drift}
                />
              </Suspense>
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

            <div className='grid grid-cols-1 items-start gap-6 lg:grid-cols-2'>
              {/* Two explicit columns, so the rate split sits under the left
              card instead of stacking the right column far below it. */}
              <div className='space-y-6'>
                {profitShare.status === 'inactive' ? (
                  billingInCard
                ) : (
                  <ProfitShareCard
                    state={profitShare}
                    year={validYear}
                    month={closeMonthNumber}
                    displayMonth={displayMonth}
                    lastDayLabel={lastDayLabel}
                  />
                )}
                {rateSplitCard}
              </div>
              <div className='space-y-6'>
                {profitShare.status === 'inactive' ? null : billingInCard}
                {bookkeepingCards}
              </div>
            </div>
          </ReportBody>
        </div>
      </ReportNavigationProvider>
    </PageShell>
  )
}
