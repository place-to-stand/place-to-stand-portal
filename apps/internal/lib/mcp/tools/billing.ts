import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'
import { clientHoursTotalsFor, getClientHoursTotals } from '@pts/db/hours'
import { z } from 'zod'

import { serializeHourBlock } from '@/lib/cli/serializers/hour-block'
import {
  serializeInvoice,
  serializeInvoiceDetail,
} from '@/lib/cli/serializers/invoice'
import { isoTimestamp } from '@/lib/cli/serializers/timestamp'
import { resolveClientIdentifier } from '@/lib/data/clients'
import {
  fetchMonthlyCloseForAgent,
  type AgentProfitShareState,
} from '@/lib/data/reports/close'
import { db } from '@/lib/db'
import { NotFoundError } from '@/lib/errors/http'
import { INVOICE_STATUS_VALUES } from '@/lib/invoices/filters'
import {
  getActiveClientSummary,
  listHourBlocksForSettings,
} from '@/lib/queries/hour-blocks'
import { getInvoiceById, listInvoices } from '@/lib/queries/invoices'

import { listLimit, searchText } from '../output'
import { defineTool } from '../tool'

const clientRef = z.string().trim().min(1).describe('Client slug or UUID.')

const archived = z
  .boolean()
  .default(false)
  .describe('List archived records instead of active ones.')

const RECENT_BLOCKS = 10

/**
 * Avatar fields are UI-only and add nothing for an agent. In the close report
 * `updatedAt` only ever appears on payroll rows, where it is the user row's
 * timestamp kept to bust the avatar cache.
 */
const UI_ONLY_KEYS = new Set([
  'updatedAt',
  'avatarUrl',
  'avatarUpdatedAt',
  'originatorAvatarUrl',
  'originatorUpdatedAt',
  'closerAvatarUrl',
  'closerUpdatedAt',
])

function withoutUiFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutUiFields)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !UI_ONLY_KEYS.has(key))
        .map(([key, entry]) => [key, withoutUiFields(entry)])
    )
  }
  return value
}

/**
 * Mercury accounts carry the account id and a name that usually ends in the
 * account number's last digits, so neither leaves the server. Each account's
 * balance stays: the profit-share math (balance − payouts − minimum) is
 * stated on `data` and does not need them.
 */
function withoutBankIdentifiers(state: AgentProfitShareState) {
  if (state.status !== 'ready') {
    return state
  }

  return {
    ...state,
    data: {
      ...state.data,
      accounts: state.data.accounts.map(account => ({
        balance: account.balance,
      })),
    },
  }
}

/** `totalCount` counts every match, so it answers `hasMore` without a probe row. */
function bounded<T>(items: T[], totalCount: number) {
  return { items, hasMore: totalCount > items.length, totalCount }
}

/**
 * Invoices, hour blocks and the monthly close: read-only (D9 as revised).
 * Nothing here creates, sends, voids or closes anything.
 */
export function registerBillingTools(server: McpServer) {
  defineTool(server, {
    name: 'list_invoices',
    title: 'List invoices',
    description:
      'List invoices, newest first. Filter by client, status or text (invoice number or client name); when hasMore is true, narrow the filters. Amounts are decimal strings in USD. get_invoice returns line items and notes.',
    access: 'admin',
    effect: 'read',
    input: {
      client: clientRef.optional(),
      status: z.enum(INVOICE_STATUS_VALUES).optional(),
      search: searchText.optional(),
      archived,
      limit: listLimit,
    },
    run: async ({ client, status, search, archived, limit }, { user }) => {
      const clientId = client
        ? (await resolveClientIdentifier(user, client)).resolvedId
        : undefined

      const result = await listInvoices(user, {
        status: archived ? 'archived' : 'active',
        clientId,
        invoiceStatus: status,
        search,
        limit,
      })

      return bounded(result.items.map(serializeInvoice), result.totalCount)
    },
  })

  defineTool(server, {
    name: 'get_invoice',
    title: 'Get invoice',
    description:
      'One invoice with its line items, notes, view count and the hour blocks it bought.',
    access: 'admin',
    effect: 'read',
    input: { invoiceId: z.string().uuid().describe('Invoice UUID.') },
    run: async ({ invoiceId }, { user }) => {
      const invoice = await getInvoiceById(user, invoiceId)

      if (!invoice) {
        throw new NotFoundError('Invoice not found.')
      }

      return { invoice: serializeInvoiceDetail(invoice) }
    },
  })

  defineTool(server, {
    name: 'list_hour_blocks',
    title: 'List hour blocks',
    description:
      'List prepaid hour blocks (hours a client bought), newest first, optionally for one client or by text (client name or invoice number); when hasMore is true, narrow the filters. get_client_hour_balance gives the remaining balance.',
    access: 'admin',
    effect: 'read',
    input: {
      client: clientRef.optional(),
      search: searchText.optional(),
      archived,
      limit: listLimit,
    },
    run: async ({ client, search, archived, limit }, { user }) => {
      const clientId = client
        ? (await resolveClientIdentifier(user, client)).resolvedId
        : null

      const result = await listHourBlocksForSettings(user, {
        status: archived ? 'archived' : 'active',
        clientId,
        search,
        offset: 0,
        limit,
      })

      return bounded(result.items.map(serializeHourBlock), result.totalCount)
    },
  })

  defineTool(server, {
    name: 'get_client_hour_balance',
    title: 'Get client hour balance',
    description: `A client's prepaid hours for the current prepaid era: purchased, used and remaining (remaining can be negative when the client is over), with its ${RECENT_BLOCKS} most recent hour blocks. Net 30 clients have no meaningful balance.`,
    access: 'admin',
    effect: 'read',
    input: { client: clientRef },
    run: async ({ client: reference }, { user }) => {
      const resolved = await resolveClientIdentifier(user, reference)
      const client = await getActiveClientSummary(user, resolved.resolvedId)

      if (!client) {
        throw new NotFoundError('Client not found or archived.')
      }

      const [totals, blocks] = await Promise.all([
        getClientHoursTotals(db, [client.id]),
        listHourBlocksForSettings(user, {
          clientId: client.id,
          offset: 0,
          limit: RECENT_BLOCKS,
        }),
      ])
      const balance = clientHoursTotalsFor(totals, client.id)

      return {
        client: {
          id: client.id,
          name: client.name,
          slug: resolved.slug,
          billingType: resolved.billingType,
        },
        hoursPurchased: balance.purchased,
        hoursUsed: balance.used,
        hoursRemaining: balance.remaining,
        recentBlocks: blocks.items.map(serializeHourBlock),
        hasMoreBlocks: blocks.totalCount > blocks.items.length,
      }
    },
  })

  defineTool(server, {
    name: 'get_monthly_close',
    title: 'Get monthly close',
    description:
      'The monthly close report for one month: per-person payroll, origination and closer commissions, partner payouts, prepaid and net 30 billing, sales tax, the house share, the rate schedule and the profit share. A closed month comes from its frozen snapshot (source "snapshot", closedAt is the snapshot date); an open month is computed live from the database (source "live"), and its profit share is unavailable because the Mercury balance is never read here. Amounts are USD numbers.',
    access: 'admin',
    effect: 'read',
    input: {
      year: z.number().int().min(2000).max(2100).describe('Four-digit year.'),
      month: z
        .number()
        .int()
        .min(1)
        .max(12)
        .describe('Month, 1–12 (1 = January).'),
    },
    run: async ({ year, month }, { user }) => {
      const close = await fetchMonthlyCloseForAgent(user, year, month)

      return withoutUiFields({
        ...close,
        closedAt: isoTimestamp(close.closedAt),
        profitShare: withoutBankIdentifiers(close.profitShare),
      }) as Record<string, unknown>
    },
  })
}
