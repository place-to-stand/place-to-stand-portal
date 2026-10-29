import 'server-only'

import { and, asc, count, eq, inArray, isNull, ne, notInArray, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertCrmAccess } from '@/lib/auth/permissions'
import type {
  SalesHomeData,
  SalesLeadItem,
  SalesPipelineStage,
} from '@/lib/dashboard/sales-types'
import { db } from '@/lib/db'
import { leads, projects, taskAssignees, tasks } from '@/lib/db/schema'
import {
  LEAD_STATUS_LABELS,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import { listWorkableProjectIds } from '@/lib/projects/access'
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

const NEXT_STEPS_LIMIT = 15
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

/**
 * Open tasks assigned to this user on projects they can work, overdue and
 * soonest-due first, undated last.
 */
export async function fetchSalesNextSteps(user: AppUser) {
  const workable = await listWorkableProjectIds(user)
  if (workable !== null && workable.length === 0) {
    return { items: [], total: 0 }
  }

  const where = and(
    eq(taskAssignees.userId, user.id),
    isNull(taskAssignees.deletedAt),
    isNull(tasks.deletedAt),
    isNull(tasks.acceptedAt),
    ne(tasks.status, 'DONE'),
    isNull(projects.deletedAt),
    workable === null ? undefined : inArray(tasks.projectId, workable)
  )

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        dueOn: tasks.dueOn,
        projectName: projects.name,
        leadId: tasks.leadId,
        leadName: leads.contactName,
      })
      .from(tasks)
      .innerJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(leads, and(eq(leads.id, tasks.leadId), isNull(leads.deletedAt)))
      .where(where)
      .orderBy(
        sql`${tasks.dueOn} asc nulls last`,
        asc(tasks.createdAt)
      )
      .limit(NEXT_STEPS_LIMIT),
    db
      .select({ value: count() })
      .from(tasks)
      .innerJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(where),
  ])

  return {
    items: rows.map(row => ({ ...row, leadName: row.leadName ?? null })),
    total: Number(totalRow?.value ?? 0),
  }
}

export async function fetchSalesHomeData(
  user: AppUser
): Promise<SalesHomeData> {
  assertCrmAccess(user)
  const now = Date.now()

  const leadFields = {
    id: leads.id,
    contactName: leads.contactName,
    companyName: leads.companyName,
    status: leads.status,
    lastTouchedAt: lastTouchedSql,
  }

  const [nextSteps, quietRows, awaitingRows, pipelineRows] = await Promise.all([
    fetchSalesNextSteps(user),
    db
      .select(leadFields)
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          eq(leads.assigneeId, user.id),
          inArray(leads.status, WORKING_STAGES),
          // Waiting leads have their own list.
          sql`coalesce(${leads.awaitingReply}, false) = false`
        )
      )
      .orderBy(asc(lastTouchedSql))
      .limit(LEAD_LIST_LIMIT),
    db
      .select(leadFields)
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          eq(leads.assigneeId, user.id),
          eq(leads.awaitingReply, true),
          notInArray(leads.status, ['CLOSED_WON', 'CLOSED_LOST', 'UNQUALIFIED'])
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
      .where(and(isNull(leads.deletedAt), inArray(leads.status, PIPELINE_STAGES)))
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
    nextSteps: nextSteps.items,
    nextStepsTotal: nextSteps.total,
    quietLeads: quietRows.map(row =>
      toLeadItem({ ...row, status: row.status as LeadStatusValue }, now)
    ),
    awaitingReply: awaitingRows.map(row =>
      toLeadItem({ ...row, status: row.status as LeadStatusValue }, now)
    ),
    pipeline,
  }
}
