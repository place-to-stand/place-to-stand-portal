import { NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'
import { invoiceUnsharedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  assertAdmin(user)

  const { id } = await params

  // Fetch the invoice to verify it exists and get metadata for logging
  const rows = await db
    .select({
      id: invoices.id,
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

  // Disable sharing but preserve the token
  await db
    .update(invoices)
    .set({ shareEnabled: false })
    .where(eq(invoices.id, id))

  // Log activity
  const event = invoiceUnsharedEvent({
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

  return NextResponse.json({ ok: true })
}
