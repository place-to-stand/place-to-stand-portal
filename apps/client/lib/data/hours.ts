import 'server-only'

import { cache } from 'react'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients, hourBlocks, projects, timeLogs } from '@pts/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { resolvePortalScope } from '@/lib/auth/view-as'

/**
 * Prepaid clients draw hours down from purchased blocks; net_30 clients are
 * invoiced for work already performed and have no balance to show.
 */
export type ClientHoursSummary =
  | {
      kind: 'prepaid'
      clientId: string
      clientName: string
      purchased: number
      used: number
      remaining: number
    }
  | {
      kind: 'net_30'
      clientId: string
      clientName: string
    }

/**
 * Hours balance per client in scope.
 *
 * Mirrors the internal app's calculation in
 * `apps/internal/lib/data/clients/index.ts`: purchased is the sum of every live
 * hour block for the client, used is the sum of every live time log across the
 * client's live projects. All-time, no date window. Remaining can go negative
 * when a client is over their purchased hours.
 *
 * SECURITY: client ids come only from resolvePortalScope — never from a route
 * param, query string, or request body — so there is no IDOR surface here.
 */
export const fetchClientHoursSummaries = cache(
  async (user: AppUser): Promise<ClientHoursSummary[]> => {
    const { clientIds } = await resolvePortalScope(user)
    if (clientIds.length === 0) return []

    const [clientRows, purchasedRows, usedRows] = await Promise.all([
      db
        .select({
          id: clients.id,
          name: clients.name,
          billingType: clients.billingType,
        })
        .from(clients)
        .where(and(inArray(clients.id, clientIds), isNull(clients.deletedAt))),
      db
        .select({
          clientId: hourBlocks.clientId,
          purchased: sql<string>`coalesce(sum(${hourBlocks.hoursPurchased}), 0)`,
        })
        .from(hourBlocks)
        .where(
          and(
            inArray(hourBlocks.clientId, clientIds),
            isNull(hourBlocks.deletedAt)
          )
        )
        .groupBy(hourBlocks.clientId),
      db
        .select({
          clientId: projects.clientId,
          used: sql<string>`coalesce(sum(${timeLogs.hours}), 0)`,
        })
        .from(timeLogs)
        .innerJoin(projects, eq(timeLogs.projectId, projects.id))
        .where(
          and(
            inArray(projects.clientId, clientIds),
            isNull(timeLogs.deletedAt),
            isNull(projects.deletedAt)
          )
        )
        .groupBy(projects.clientId),
    ])

    // numeric columns come back from postgres.js as strings.
    const purchasedByClient = new Map(
      purchasedRows.map(row => [row.clientId, toHours(row.purchased)])
    )
    const usedByClient = new Map(
      usedRows.map(row => [row.clientId, toHours(row.used)])
    )

    return clientRows
      .map((client): ClientHoursSummary => {
        if (client.billingType === 'net_30') {
          return {
            kind: 'net_30',
            clientId: client.id,
            clientName: client.name,
          }
        }

        const purchased = purchasedByClient.get(client.id) ?? 0
        const used = usedByClient.get(client.id) ?? 0

        return {
          kind: 'prepaid',
          clientId: client.id,
          clientName: client.name,
          purchased,
          used,
          remaining: purchased - used,
        }
      })
      .sort((a, b) => a.clientName.localeCompare(b.clientName))
  }
)

function toHours(value: string | number | null): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}
