import type { ProfitShareData } from '@/lib/billing/profit-share'
import type { MonthlyCloseReport } from '@/lib/data/reports/types'

import { formatHours, formatMoney } from './format'

export type PayoutColumn = 'payroll' | 'origination' | 'closer' | 'profitShare'

export type PayoutDetailLine = {
  label: string
  column: PayoutColumn
  amount: number
}

export type PayoutTableRow = {
  key: string
  kind: 'user' | 'contact'
  id: string
  name: string
  avatarUpdatedAt: string | null
  secondary: string
  payroll: number
  origination: number
  closer: number
  profitShare: number
  total: number
  details: PayoutDetailLine[]
}

export type PayoutTable = {
  rows: PayoutTableRow[]
  totals: Record<PayoutColumn, number> & { total: number }
}

type Draft = Omit<PayoutTableRow, 'secondary' | 'total'> & {
  hoursWorked: number | null
  referredClients: string[]
}

/**
 * One row per person to pay: the report's payees plus the profit-share
 * partners, who get a row even in a month with no payroll, origination or
 * closer amount. Each row carries the lines behind its numbers for the
 * expanded view.
 */
export function buildPayoutTable(
  report: MonthlyCloseReport,
  profitShare: ProfitShareData | null
): PayoutTable {
  const drafts = new Map<string, Draft>()

  const ensure = (init: {
    kind: 'user' | 'contact'
    id: string
    name: string
    avatarUpdatedAt: string | null
  }): Draft => {
    const key = `${init.kind}:${init.id}`
    let draft = drafts.get(key)
    if (!draft) {
      draft = {
        key,
        ...init,
        payroll: 0,
        origination: 0,
        closer: 0,
        profitShare: 0,
        details: [],
        hoursWorked: null,
        referredClients: [],
      }
      drafts.set(key, draft)
    }
    if (!draft.avatarUpdatedAt && init.avatarUpdatedAt) {
      draft.avatarUpdatedAt = init.avatarUpdatedAt
    }
    return draft
  }

  for (const row of report.partnerPayouts.rows) {
    const draft = ensure({
      kind: row.kind,
      id: row.id,
      name: row.name,
      avatarUpdatedAt: row.avatarUrl ? row.avatarUpdatedAt : null,
    })
    draft.payroll = row.payrollAmount
    draft.origination = row.originationAmount
    draft.closer = row.closerAmount
  }

  for (const row of report.payroll.rows) {
    const draft = ensure({
      kind: 'user',
      id: row.userId,
      name: row.fullName ?? row.email,
      avatarUpdatedAt: row.avatarUrl ? row.updatedAt : null,
    })
    draft.hoursWorked = row.totalHours
    draft.details.push({
      label: `Payroll · ${formatHours(row.totalHours)} hrs worked × $${report.payroll.hourlyRate}`,
      column: 'payroll',
      amount: row.amount,
    })
  }

  for (const group of report.origination.rows) {
    const draft = ensure({
      kind: group.originatorKind,
      id: group.originatorId,
      name: group.originatorName,
      avatarUpdatedAt: group.originatorAvatarUrl
        ? group.originatorUpdatedAt
        : null,
    })
    for (const client of group.clients) {
      draft.referredClients.push(client.clientName)
      draft.details.push({
        label: `Origination · ${client.clientName} · ${formatHours(client.hours)} hrs`,
        column: 'origination',
        amount: client.commission,
      })
    }
  }

  for (const group of report.closer.rows) {
    const draft = ensure({
      kind: 'user',
      id: group.closerUserId,
      name: group.closerName ?? group.closerEmail,
      avatarUpdatedAt: group.closerAvatarUrl ? group.closerUpdatedAt : null,
    })
    for (const client of group.clients) {
      draft.details.push({
        label: `Closer · ${client.clientName} · ${formatHours(client.hours)} hrs`,
        column: 'closer',
        amount: client.commission,
      })
    }
  }

  if (profitShare) {
    const percent = Math.round(100 / Math.max(profitShare.partners.length, 1))
    for (const partner of profitShare.partners) {
      const draft = ensure({
        kind: 'user',
        id: partner.userId,
        name: partner.name,
        avatarUpdatedAt: partner.avatarUpdatedAt,
      })
      draft.profitShare = partner.amount
      draft.details.push({
        label: `Profit share · ${percent}% of ${formatMoney(profitShare.available)}`,
        column: 'profitShare',
        amount: partner.amount,
      })
    }
  }

  const rows = Array.from(drafts.values())
    .map(({ hoursWorked, referredClients, ...draft }) => ({
      ...draft,
      secondary:
        draft.kind === 'contact'
          ? `Referred ${Array.from(new Set(referredClients)).join(', ')}`
          : hoursWorked !== null
            ? `${formatHours(hoursWorked)} hrs worked`
            : 'No hours this month',
      total:
        draft.payroll + draft.origination + draft.closer + draft.profitShare,
    }))
    // Biggest check first — cut them in order of size.
    .sort((a, b) => b.total - a.total)

  const profitShareTotal = profitShare?.totalAmount ?? 0

  return {
    rows,
    totals: {
      payroll: report.partnerPayouts.totalPayroll,
      origination: report.partnerPayouts.totalOrigination,
      closer: report.partnerPayouts.totalCloser,
      profitShare: profitShareTotal,
      total: report.partnerPayouts.totalAmount + profitShareTotal,
    },
  }
}
