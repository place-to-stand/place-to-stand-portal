export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { Card } from '@pts/ui/card'
import { EmptyState } from '@pts/ui/empty-state'

import { requireClientUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { resolvePortalScope } from '@/lib/auth/view-as'
import { getEnv } from '@/lib/env.server'
import { fetchClientInvoices, type ClientInvoice } from '@/lib/data/invoices'
import { InvoiceList } from '@/components/invoices/invoice-list'

type InvoicesPageProps = {
  /** `?client=<id>` narrows the page to one client (the dashboard links here per client section). */
  searchParams: Promise<{ client?: string | string[] }>
}

export default async function InvoicesPage({
  searchParams,
}: InvoicesPageProps) {
  const user = await requireClientUser()
  const [allInvoices, scope, { client }] = await Promise.all([
    fetchClientInvoices(user),
    resolvePortalScope(user),
    searchParams,
  ])

  // Only honor a client the viewer can see; anything else shows everything.
  const filterClient =
    typeof client === 'string'
      ? scope.scopedClients.find(option => option.id === client)
      : undefined
  const invoices = filterClient
    ? allInvoices.filter(invoice => invoice.clientId === filterClient.id)
    : allInvoices
  const hasSeveralClients = scope.scopedClients.length > 1

  const needsClientSelection = isAdmin(user) && scope.clientIds.length === 0
  const internalPortalUrl = getEnv().INTERNAL_PORTAL_URL

  return (
    <div className='space-y-6'>
      <Link
        href='/'
        className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm'
      >
        <ArrowLeftIcon className='size-4' />
        Back to dashboard
      </Link>

      <div>
        <h1 className='text-foreground text-3xl font-semibold tracking-tight'>
          Invoices
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          View or download any of your invoices, and pay the ones still open.
        </p>
        {filterClient && hasSeveralClients && (
          <p className='mt-3 text-sm'>
            <span className='font-medium'>{filterClient.name}</span>
            <span className='text-muted-foreground'> · </span>
            <Link
              href='/invoices'
              className='text-muted-foreground hover:text-foreground underline-offset-4 hover:underline'
            >
              Show all clients
            </Link>
          </p>
        )}
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          message={
            needsClientSelection
              ? 'Select a contact above to preview the portal.'
              : 'No invoices yet.'
          }
        />
      ) : hasSeveralClients && !filterClient ? (
        <GroupedByClient
          invoices={invoices}
          internalPortalUrl={internalPortalUrl}
        />
      ) : (
        <Card className='gap-0 overflow-hidden px-4 py-0'>
          <InvoiceList
            invoices={invoices}
            internalPortalUrl={internalPortalUrl}
          />
        </Card>
      )}
    </div>
  )
}

/**
 * Viewers linked to more than one client need to know whose invoice is whose.
 * Mirrors the `showClientName` convention on HoursSummaryCard.
 */
function GroupedByClient({
  invoices,
  internalPortalUrl,
}: {
  invoices: ClientInvoice[]
  internalPortalUrl: string
}) {
  const groups = new Map<string, ClientInvoice[]>()

  // fetchClientInvoices is already sorted newest-first, and Map preserves
  // insertion order, so each group keeps that ordering.
  for (const invoice of invoices) {
    const existing = groups.get(invoice.clientName)
    if (existing) {
      existing.push(invoice)
    } else {
      groups.set(invoice.clientName, [invoice])
    }
  }

  return (
    <div className='space-y-6'>
      {[...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([clientName, clientInvoices]) => (
          <section key={clientName} className='space-y-2'>
            <h2 className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
              {clientName}
            </h2>
            <Card className='gap-0 overflow-hidden px-4 py-0'>
              <InvoiceList
                invoices={clientInvoices}
                internalPortalUrl={internalPortalUrl}
              />
            </Card>
          </section>
        ))}
    </div>
  )
}
