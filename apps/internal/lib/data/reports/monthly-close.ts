import 'server-only'

import { cache } from 'react'

import {
  fetchEmployeePayroll,
  fetchReferralCommissions,
  fetchPrepaidBilling,
  fetchNet30Billing,
  fetchReportDateBounds,
  EMPLOYEE_HOURLY_RATE,
  REFERRAL_COMMISSION_PER_HOUR,
  PREPAID_HOURLY_RATE,
  NET_30_HOURLY_RATE,
} from '@/lib/queries/reports/monthly-close'
import type {
  MonthlyCloseReport,
  PayrollData,
  PayrollRow,
  ReferralsData,
  ReferralGroupRow,
  ReferralClientDetail,
  PrepaidBillingData,
  PrepaidBillingRow,
  Net30Data,
  Net30Row,
} from './types'

/**
 * Fetches and assembles the complete Monthly Close Report for a date range.
 * Includes employee payroll, referral commissions (grouped by referrer),
 * prepaid billing, and net_30 client billing.
 *
 * @param startDate - Start date in 'yyyy-MM-dd' format (inclusive)
 * @param endDate - End date in 'yyyy-MM-dd' format (inclusive)
 */
export const fetchMonthlyCloseReport = cache(
  async (startDate: string, endDate: string): Promise<MonthlyCloseReport> => {
    // Fetch all data sources in parallel
    const [payrollRows, referralRows, prepaidRows, net30Rows, bounds] =
      await Promise.all([
        fetchEmployeePayroll(startDate, endDate),
        fetchReferralCommissions(startDate, endDate),
        fetchPrepaidBilling(startDate, endDate),
        fetchNet30Billing(startDate, endDate),
        fetchReportDateBounds(),
      ])

    // Assemble payroll data
    const payrollData: PayrollRow[] = payrollRows.map(row => {
      const totalHours = Number(row.totalHours ?? '0')
      return {
        userId: row.userId,
        fullName: row.fullName,
        email: row.email,
        totalHours: Number.isFinite(totalHours) ? totalHours : 0,
        amount:
          (Number.isFinite(totalHours) ? totalHours : 0) * EMPLOYEE_HOURLY_RATE,
      }
    })

    const payrollTotalHours = payrollData.reduce(
      (sum, row) => sum + row.totalHours,
      0
    )

    const payroll: PayrollData = {
      rows: payrollData,
      totalHours: payrollTotalHours,
      totalAmount: payrollTotalHours * EMPLOYEE_HOURLY_RATE,
      hourlyRate: EMPLOYEE_HOURLY_RATE,
    }

    // Assemble referrals data - grouped by referrer
    const referrerMap = new Map<
      string,
      {
        referrerId: string
        referrerName: string
        clients: ReferralClientDetail[]
      }
    >()

    for (const row of referralRows) {
      const hoursPurchased = Number(row.hoursPurchased ?? '0')
      const validHours = Number.isFinite(hoursPurchased) ? hoursPurchased : 0

      const clientDetail: ReferralClientDetail = {
        clientId: row.clientId,
        clientName: row.clientName,
        hoursPurchased: validHours,
        commission: validHours * REFERRAL_COMMISSION_PER_HOUR,
      }

      const existing = referrerMap.get(row.referrerId)
      if (existing) {
        existing.clients.push(clientDetail)
      } else {
        referrerMap.set(row.referrerId, {
          referrerId: row.referrerId,
          referrerName: row.referrerName,
          clients: [clientDetail],
        })
      }
    }

    // Convert map to array and calculate totals for each referrer
    const referralGroupRows: ReferralGroupRow[] = Array.from(
      referrerMap.values()
    ).map(group => {
      const totalHoursPurchased = group.clients.reduce(
        (sum, c) => sum + c.hoursPurchased,
        0
      )
      return {
        referrerId: group.referrerId,
        referrerName: group.referrerName,
        clients: group.clients,
        totalHoursPurchased,
        totalCommission: totalHoursPurchased * REFERRAL_COMMISSION_PER_HOUR,
      }
    })

    const referralsTotalHours = referralGroupRows.reduce(
      (sum, row) => sum + row.totalHoursPurchased,
      0
    )

    const referrals: ReferralsData = {
      rows: referralGroupRows,
      totalHours: referralsTotalHours,
      totalAmount: referralsTotalHours * REFERRAL_COMMISSION_PER_HOUR,
      commissionPerHour: REFERRAL_COMMISSION_PER_HOUR,
    }

    // Assemble prepaid billing data
    const prepaidData: PrepaidBillingRow[] = prepaidRows.map(row => {
      const totalHours = Number(row.totalHours ?? '0')
      return {
        clientId: row.clientId,
        clientName: row.clientName,
        totalHours: Number.isFinite(totalHours) ? totalHours : 0,
        amount:
          (Number.isFinite(totalHours) ? totalHours : 0) * PREPAID_HOURLY_RATE,
      }
    })

    const prepaidTotalHours = prepaidData.reduce(
      (sum, row) => sum + row.totalHours,
      0
    )

    const prepaidBilling: PrepaidBillingData = {
      rows: prepaidData,
      totalHours: prepaidTotalHours,
      totalAmount: prepaidTotalHours * PREPAID_HOURLY_RATE,
      hourlyRate: PREPAID_HOURLY_RATE,
    }

    // Assemble net30 billing data
    const net30Data: Net30Row[] = net30Rows.map(row => {
      const totalHours = Number(row.totalHours ?? '0')
      return {
        clientId: row.clientId,
        clientName: row.clientName,
        totalHours: Number.isFinite(totalHours) ? totalHours : 0,
        amount:
          (Number.isFinite(totalHours) ? totalHours : 0) * NET_30_HOURLY_RATE,
      }
    })

    const net30TotalHours = net30Data.reduce(
      (sum, row) => sum + row.totalHours,
      0
    )

    const net30Billing: Net30Data = {
      rows: net30Data,
      totalHours: net30TotalHours,
      totalAmount: net30TotalHours * NET_30_HOURLY_RATE,
      hourlyRate: NET_30_HOURLY_RATE,
    }

    return {
      payroll,
      referrals,
      prepaidBilling,
      net30Billing,
      minCursor: bounds.min,
      maxCursor: bounds.max,
    }
  }
)
