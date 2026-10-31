import 'server-only'

import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertCrmAccess } from '@/lib/auth/permissions'
import type {
  SalesHomeData,
  SalesLeadItem,
  SalesPipelineStage,
} from '@/lib/dashboard/sales-types'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import {
  leadCompany,
  leadCompanyJoin,
  leadContact,
  leadContactJoin,
  leadDisplayFields,
} from '@/lib/leads/lead-display'
import { LEAD_STATUS_LABELS, type LeadStatusValue } from '@/lib/leads/constants'
import { todayCalendarDate } from '@/lib/updates/window'

/** Stages the pipeline widget counts: everything still in play. */
const PIPELINE_STAGES: LeadStatusValue[] = [
  'NEW_OPPORTUNITIES',
  'ACTIVE_OPPORTUNITIES',
  'PROPOSAL_SENT',
  'ON_ICE',
]

/** Leads that are still being worked (on-ice leads are quiet on purpose). */
const WORKING_STAGES: LeadStatusValue[] = [
  'NEW_OPPORTUNITIES',
  'ACTIVE_OPPORTUNITIES',
  'PROPOSAL_SENT',
]

const LEAD_LIST_LIMIT = 10
const DAY_MS = 24 * 60 * 60 * 1000

// Raw SQL on purpose: the correlated subquery must reference the outer
// `leads` row by its table name.
const lastTouchedSql = sql<string>`coalesce(
  (select max(lu.occurred_at) from lead_updates lu
   where lu.lead_id = leads.id and lu.deleted_at is null),
  leads.created_at
)`

function toLeadItem(
  row: {
    id: string
    contactName: string
    companyName: string | null
    status: LeadStatusValue
    lastTouchedAt: string
  },
  now: number
): SalesLeadItem {
  const touched = new Date(row.lastTouchedAt).getTime()
  return {
    ...row,
    lastTouchedAt: new Date(touched).toISOString(),
    daysSinceTouch: Math.max(0, Math.floor((now - touched) / DAY_MS)),
  }
}

export async function fetchSalesHomeData(
  user: AppUser
): Promise<SalesHomeData> {
  assertCrmAccess(user)
  const now = Date.now()

  const leadFields = {
    id: leads.id,
    contactName: leadDisplayFields.contactName,
    companyName: leadDisplayFields.companyName,
    status: leads.status,
    lastTouchedAt: lastTouchedSql,
  }

  const [quietRows, pipelineRows] = await Promise.all([
    db
      .select(leadFields)
      .from(leads)
      .innerJoin(leadContact, leadContactJoin)
      .leftJoin(leadCompany, leadCompanyJoin)
      .where(
        and(
          isNull(leads.deletedAt),
          eq(leads.assigneeId, user.id),
          inArray(leads.status, WORKING_STAGES)
        )
      )
      .orderBy(asc(lastTouchedSql))
      .limit(LEAD_LIST_LIMIT),
    db
      .select({
        status: leads.status,
        total: count(),
        mine: sql<number>`count(*) filter (where ${leads.assigneeId} = ${user.id})`,
      })
      .from(leads)
      .where(
        and(isNull(leads.deletedAt), inArray(leads.status, PIPELINE_STAGES))
      )
      .groupBy(leads.status),
  ])

  const pipeline: SalesPipelineStage[] = PIPELINE_STAGES.map(status => {
    const row = pipelineRows.find(item => item.status === status)
    return {
      status,
      label: LEAD_STATUS_LABELS[status],
      total: Number(row?.total ?? 0),
      mine: Number(row?.mine ?? 0),
    }
  })

  return {
    today: todayCalendarDate(),
    quietLeads: quietRows.map(row =>
      toLeadItem({ ...row, status: row.status as LeadStatusValue }, now)
    ),
    pipeline,
  }
}
