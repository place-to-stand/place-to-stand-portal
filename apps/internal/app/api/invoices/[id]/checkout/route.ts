import { NextResponse } from 'next/server'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import { appOrigin } from '@/lib/app-origin'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'
import { authorizeRoute } from '@/lib/auth/guard'

export async function POST(
  _request: Request,
  { params }: RouteContext<'/api/invoices/[id]/checkout'>
) {
  try {
    const { user, denied } = await authorizeRoute('billing.manage')
    if (denied) return denied
    assertAdmin(user)

    const { id } = await params

    // Fetch invoice
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1)

    if (!invoice) {
      return NextResponse.json(
        { ok: false, error: 'Invoice not found.' },
        { status: 404 }
      )
    }

    // Validate status
    if (invoice.status !== 'SENT' && invoice.status !== 'VIEWED') {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invoice must be in SENT or VIEWED status to create a checkout session.',
        },
        { status: 400 }
      )
    }

    if (!invoice.shareEnabled) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Sharing must be enabled to create a checkout session.',
        },
        { status: 400 }
      )
    }

    // If a checkout session already exists, try to reuse it
    if (invoice.stripeCheckoutSessionId) {
      try {
        const existingSession = await getStripe().checkout.sessions.retrieve(
          invoice.stripeCheckoutSessionId
        )
        // Only while it still charges this invoice's total.
        if (
          existingSession.status === 'open' &&
          existingSession.client_secret &&
          existingSession.amount_total ===
            Math.round(Number(invoice.total) * 100)
        ) {
          return NextResponse.json({
            ok: true,
            data: { clientSecret: existingSession.client_secret },
          })
        }
      } catch {
        // Session no longer valid, create a new one
      }
    }

    const appBaseUrl = appOrigin()

    // Send total as a single line item so the embedded checkout header
    // shows "Invoice INV-XXXX" instead of duplicating the line-item breakdown.
    const totalCents = Math.round(Number(invoice.total) * 100)
    const invoiceLabel = invoice.invoiceNumber
      ? `Invoice ${invoice.invoiceNumber}`
      : 'Invoice Payment'

    const stripeLineItems = [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: invoiceLabel },
          unit_amount: totalCents,
        },
        quantity: 1,
      },
    ]

    // Create Stripe Checkout Session (embedded mode)
    const session = await getStripe().checkout.sessions.create({
      // Stripe API v22 renamed 'embedded' to 'embedded_page'; behavior is
      // unchanged (session.client_secret still drives the embedded form).
      ui_mode: 'embedded_page',
      mode: 'payment',
      line_items: stripeLineItems,
      return_url: `${appBaseUrl}/share/invoices/${invoice.shareToken}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      metadata: { invoiceId: invoice.id },
      client_reference_id: invoice.id,
    })

    // Store checkout session ID on invoice. Only while the invoice is still
    // payable and unchanged: a void, revert, archive or edit that ran
    // meanwhile could not see this session, so it is expired instead.
    const stored = await db
      .update(invoices)
      .set({
        // No updatedAt: Stripe bookkeeping is not an edit, so an open
        // invoice sheet doesn't take it for someone else's save.
        stripeCheckoutSessionId: session.id,
      })
      .where(
        and(
          eq(invoices.id, id),
          inArray(invoices.status, ['SENT', 'VIEWED']),
          isNull(invoices.deletedAt),
          eq(invoices.total, invoice.total),
          sql`${invoices.stripeCheckoutSessionId} is not distinct from ${invoice.stripeCheckoutSessionId}`
        )
      )
      .returning({ id: invoices.id })

    if (stored.length === 0) {
      try {
        await getStripe().checkout.sessions.expire(session.id)
      } catch (err) {
        console.error(
          '[api/invoices/checkout] Could not expire a session for an invoice that changed',
          { invoiceId: id, sessionId: session.id, err }
        )
      }
      return NextResponse.json(
        {
          ok: false,
          error: 'This invoice changed. Refresh the page and try again.',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: { clientSecret: session.client_secret },
    })
  } catch (err) {
    console.error('[api/invoices/checkout] Unhandled error:', err)
    return NextResponse.json(
      {
        ok: false,
        error: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    )
  }
}
