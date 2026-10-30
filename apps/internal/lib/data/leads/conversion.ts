import { wasClientCompany, clientEndedAtSql } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import 'server-only'

import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { companies, contacts, leads, projects } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import type { LeadConversionSummary } from '@/lib/leads/types'

/**
 * What a converted lead became. The lead records the client; the contact is
 * the lead's own contact (live), and projects are the client's live
 * projects — conversion doesn't
 * tag the project it creates, so linking to an existing client can surface
 * work that predates the lead.
 *
 * Returns null when the lead isn't converted. Archived leads still resolve,
 * since their sheet opens from the leads archive.
 */
export async function fetchLeadConversionSummary(
  user: AppUser,
  leadId: string
): Promise<LeadConversionSummary | null> {
  assertAdmin(user)

  const [lead] = await db
    .select({
      convertedToClientId: sql<string | null>`case when ${leads.convertedAt} is not null then ${leads.companyId} end`,
      contactId: leads.contactId,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!lead) {
    throw new NotFoundError('Lead not found')
  }

  const clientId = lead.convertedToClientId
  if (!clientId) return null

  const [clientRows, contactRows, projectRows] = await Promise.all([
    db
      .select({
        id: companies.id,
        name: clientNameSql,
        slug: companies.slug,
        companyId: companies.id,
        deletedAt: clientEndedAtSql,
      })
      .from(companies)
      .where(and(wasClientCompany(), eq(companies.id, clientId)))
      .limit(1),
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
      })
      .from(contacts)
      .where(and(eq(contacts.id, lead.contactId), isNull(contacts.deletedAt)))
      .limit(1),
    db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        status: projects.status,
      })
      .from(projects)
      .where(and(eq(projects.companyId, clientId), isNull(projects.deletedAt)))
      .orderBy(asc(projects.name)),
  ])

  const client = clientRows[0]
  if (!client) return null

  return {
    client: {
      id: client.id,
      name: client.name,
      slug: client.slug,
      companyId: client.companyId,
      archived: client.deletedAt !== null,
    },
    contact: contactRows[0] ?? null,
    projects: projectRows,
  }
}
