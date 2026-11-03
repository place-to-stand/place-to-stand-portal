import 'server-only'

import { personNameSql } from '@pts/db/names'
import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contacts, leads, users } from '@/lib/db/schema'
import type { TaskLead } from '@/lib/types'

/**
 * The leads these tasks are linked to, by id, for the card's lead line and
 * the task sheet's lead row. An archived lead is left out.
 */
export async function loadTaskLeads(
  leadIds: Array<string | null>
): Promise<Map<string, TaskLead>> {
  const ids = [...new Set(leadIds.filter((id): id is string => Boolean(id)))]
  if (!ids.length) return new Map()

  const rows = await db
    .select({
      id: leads.id,
      name: contacts.name,
      status: leads.status,
      assigneeName: personNameSql,
      assigneeEmail: users.email,
    })
    .from(leads)
    .innerJoin(contacts, eq(contacts.id, leads.contactId))
    .leftJoin(users, eq(users.id, leads.assigneeId))
    .where(and(inArray(leads.id, ids), isNull(leads.deletedAt)))

  return new Map(
    rows.map(row => [
      row.id,
      {
        id: row.id,
        name: row.name,
        status: row.status,
        assigneeName: row.assigneeName ?? row.assigneeEmail ?? null,
      },
    ])
  )
}
