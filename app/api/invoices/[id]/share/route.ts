import crypto from 'node:crypto'

import { NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'
import { invoiceSharedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'

const SHAREABLE_STATUSES = ['SENT', 'VIEWED', 'PAID'] as const

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  assertAdmin(user)

  const { id } = await params

  // Fetch the invoice
  const rows = await db
    .select({
      id: invoices.id,
      status: invoices.status,
      shareToken: invoices.shareToken,
      shareEnabled: invoices.shareEnabled,
      invoiceNumber: invoices.invoiceNumber,
      clientId: invoices.clientId,
    })
    .from(invoices)
    .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
    .limit(1)

  const invoice = rows[0]

  if (!invoice) {
    return NextResponse.json(
      { ok: false, error: 'Invoice not found.' },
      { status: 404 }
    )
  }

  // Validate status - must not be DRAFT or VOID
  if (
    !SHAREABLE_STATUSES.includes(
      invoice.status as (typeof SHAREABLE_STATUSES)[number]
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Sharing is only available for sent, viewed, or paid invoices.',
      },
      { status: 422 }
    )
  }

  // Reuse existing token or generate a new one
  const shareToken =
    invoice.shareToken ?? crypto.randomUUID().replace(/-/g, '')

  await db
    .update(invoices)
    .set({ shareToken, shareEnabled: true })
    .where(eq(invoices.id, id))

  // Log activity
  const event = invoiceSharedEvent({
    invoiceNumber: invoice.invoiceNumber,
  })

  await logActivity({
    actorId: user.id,
    verb: event.verb,
    summary: event.summary,
    targetType: 'INVOICE',
    targetId: invoice.id,
    targetClientId: invoice.clientId,
    metadata: event.metadata,
  })

  return NextResponse.json({ ok: true, data: { shareToken } })
}
