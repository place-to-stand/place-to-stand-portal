import 'server-only'

import { cache } from 'react'
import { and, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients } from '@pts/db/schema'
import { clientHoursTotalsFor, getClientHoursTotals } from '@pts/db/hours'
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
 * Delegates to `getClientHoursTotals` in `@pts/db/hours` — the same query the
 * internal portal uses — so the client portal can never disagree with what the
 * team sees internally. Remaining can go negative when a client is over their
 * purchased hours.
 *
 * SECURITY: client ids come only from resolvePortalScope — never from a route
 * param, query string, or request body — so there is no IDOR surface here.
 */
export const fetchClientHoursSummaries = cache(
  async (user: AppUser): Promise<ClientHoursSummary[]> => {
    const { clientIds } = await resolvePortalScope(user)
    if (clientIds.length === 0) return []

    const [clientRows, hoursByClient] = await Promise.all([
      db
        .select({
          id: clients.id,
          name: clients.name,
          billingType: clients.billingType,
        })
        .from(clients)
        .where(and(inArray(clients.id, clientIds), isNull(clients.deletedAt))),
      getClientHoursTotals(db, clientIds),
    ])

    return clientRows
      .map((client): ClientHoursSummary => {
        if (client.billingType === 'net_30') {
          return {
            kind: 'net_30',
            clientId: client.id,
            clientName: client.name,
          }
        }

        const { purchased, used, remaining } = clientHoursTotalsFor(
          hoursByClient,
          client.id
        )

        return {
          kind: 'prepaid',
          clientId: client.id,
          clientName: client.name,
          purchased,
          used,
          remaining,
        }
      })
      .sort((a, b) => a.clientName.localeCompare(b.clientName))
  }
)
