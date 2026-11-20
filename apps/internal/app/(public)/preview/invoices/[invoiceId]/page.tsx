import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'
import { getBusinessIdentity } from '@/lib/business/identity'
import { getInvoiceById } from '@/lib/queries/invoices'
import { UUID_PATTERN } from '@/lib/sheets/entities'

import { PublicInvoice } from '../../../share/invoices/[token]/public-invoice'

export async function generateMetadata(): Promise<Metadata> {
  const business = await getBusinessIdentity()
  return {
    title: { absolute: `Invoice preview | ${business.name}` },
    robots: { index: false, follow: false },
  }
}

/**
 * The client's invoice page as an admin sees it before sending: by id, behind
 * sign-in (this path is not on the proxy allowlist, and
 * `requirePage('billing.manage')` bounces anyone who can't manage billing),
 * with no view recorded and no live checkout.
 * Drafts have no public link, so this is the only way to see one.
 */
export default async function InvoicePreviewPage({
  params,
}: PageProps<'/preview/invoices/[invoiceId]'>) {
  const { invoiceId } = await params
  if (!UUID_PATTERN.test(invoiceId)) notFound()

  const user = await requirePage('billing.manage')
  const invoice = await getInvoiceById(user, invoiceId)
  if (!invoice || invoice.deleted_at) notFound()

  return (
    <PublicInvoice
      invoice={invoice}
      shareToken={invoice.share_token ?? ''}
      preview
    />
  )
}
