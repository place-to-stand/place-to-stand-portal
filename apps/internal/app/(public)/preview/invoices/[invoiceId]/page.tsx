import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth/session'
import { getInvoiceById } from '@/lib/queries/invoices'
import { UUID_PATTERN } from '@/lib/sheets/entities'

import { PublicInvoice } from '../../../share/invoices/[token]/public-invoice'

type Props = {
  params: Promise<{ invoiceId: string }>
}

export const metadata: Metadata = {
  title: { absolute: 'Invoice preview | Place To Stand' },
  robots: { index: false, follow: false },
}

/**
 * The client's invoice page as an admin sees it before sending: by id, behind
 * sign-in (this path is not on the proxy allowlist, and `requireUser` bounces
 * anyone who is not an admin), with no view recorded and no live checkout.
 * Drafts have no public link, so this is the only way to see one.
 */
export default async function InvoicePreviewPage({ params }: Props) {
  const { invoiceId } = await params
  if (!UUID_PATTERN.test(invoiceId)) notFound()

  const user = await requireUser()
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
