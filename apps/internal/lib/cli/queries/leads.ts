import 'server-only'

import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm'

import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import type { LeadStatusValue } from '@/lib/leads/constants'
import { UUID_PATTERN } from '@/lib/sheets/entities'

const leadFields = {
  id: leads.id,
  contactName: leads.contactName,
  status: leads.status,
  sourceType: leads.sourceType,
  sourceDetail: leads.sourceDetail,
  assigneeId: leads.assigneeId,
  contactEmail: leads.contactEmail,
  contactPhone: leads.contactPhone,
  companyName: leads.companyName,
  companyWebsite: leads.companyWebsite,
  notes: leads.notes,
  rank: leads.rank,
  currentStageEnteredAt: leads.currentStageEnteredAt,
  resolvedAt: leads.resolvedAt,
  lossReason: leads.lossReason,
  lossNotes: leads.lossNotes,
  convertedAt: leads.convertedAt,
  convertedToClientId: leads.convertedToClientId,
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
}

export type CliLeadRow = Pick<
  typeof leads.$inferSelect,
  keyof typeof leadFields
>

export type CliLeadFilters = {
  status?: LeadStatusValue
  assigneeId?: string
  search?: string
  limit: number
}

/**
 * Most recently updated first, like the task listing — a CLI caller asks
 * "what moved lately", and board rank only orders within one column.
 */
export async function listLeadsForCli(
  user: AppUser,
  { status, assigneeId, search, limit }: CliLeadFilters
): Promise<CliLeadRow[]> {
  assertAdmin(user)

  const conditions = [isNull(leads.deletedAt)]

  if (status) {
    conditions.push(eq(leads.status, status))
  }

  if (assigneeId) {
    conditions.push(eq(leads.assigneeId, assigneeId))
  }

  if (search) {
    const pattern = `%${search}%`
    const match = or(
      ilike(leads.contactName, pattern),
      ilike(leads.companyName, pattern),
      ilike(leads.contactEmail, pattern)
    )

    if (match) {
      conditions.push(match)
    }
  }

  return db
    .select(leadFields)
    .from(leads)
    .where(and(...conditions))
    .orderBy(desc(leads.updatedAt))
    .limit(limit)
}

/**
 * One active lead, or NotFound. Deliberately not wrapped in React `cache()`:
 * the PATCH route reads the row before and after the write in one request,
 * and a memoized read would hand back the stale pre-write row.
 */
export async function getLeadForCli(
  user: AppUser,
  leadId: string
): Promise<CliLeadRow> {
  assertAdmin(user)

  // Guard before the query: a non-UUID would surface as a driver cast error.
  if (!UUID_PATTERN.test(leadId)) {
    throw new NotFoundError('Lead not found.')
  }

  const [row] = await db
    .select(leadFields)
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)

  if (!row) {
    throw new NotFoundError('Lead not found.')
  }

  return row
}
