export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { requireClientUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { resolvePortalScope } from '@/lib/auth/view-as'
import { getEnv } from '@/lib/env.server'
import { fetchClientInvoices, type ClientInvoice } from '@/lib/data/invoices'
import { InvoiceList } from '@/components/invoices/invoice-list'

export default async function InvoicesPage() {
  const user = await requireClientUser()
  const [invoices, scope] = await Promise.all([
    fetchClientInvoices(user),
    resolvePortalScope(user),
  ])

  const needsClientSelection = isAdmin(user) && scope.clientIds.length === 0
  const internalPortalUrl = getEnv().INTERNAL_PORTAL_URL

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View or download any of your invoices, and pay the ones still open.
        </p>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {needsClientSelection
              ? 'Select a contact above to preview the portal.'
              : 'No invoices yet. They will appear here as soon as we send you one.'}
          </p>
        </div>
      ) : scope.scopedClients.length > 1 ? (
        <GroupedByClient
          invoices={invoices}
          internalPortalUrl={internalPortalUrl}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card px-4">
          <InvoiceList
            invoices={invoices}
            internalPortalUrl={internalPortalUrl}
          />
        </div>
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
    <div className="space-y-6">
      {[...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([clientName, clientInvoices]) => (
          <section key={clientName} className="space-y-2">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {clientName}
            </h2>
            <div className="overflow-hidden rounded-lg border border-border bg-card px-4">
              <InvoiceList
                invoices={clientInvoices}
                internalPortalUrl={internalPortalUrl}
              />
            </div>
          </section>
        ))}
    </div>
  )
}
