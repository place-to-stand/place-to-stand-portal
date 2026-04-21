import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
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
        { ok: false, error: 'Invoice must be in SENT or VIEWED status to create a checkout session.' },
        { status: 400 }
      )
    }

    if (!invoice.shareEnabled) {
      return NextResponse.json(
        { ok: false, error: 'Sharing must be enabled to create a checkout session.' },
        { status: 400 }
      )
    }

    // If a checkout session already exists, try to reuse it
    if (invoice.stripeCheckoutSessionId) {
      try {
        const existingSession = await getStripe().checkout.sessions.retrieve(
          invoice.stripeCheckoutSessionId
        )
        if (existingSession.status === 'open' && existingSession.client_secret) {
          return NextResponse.json({
            ok: true,
            data: { clientSecret: existingSession.client_secret },
          })
        }
      } catch {
        // Session no longer valid, create a new one
      }
    }

    const appBaseUrl =
      process.env.APP_BASE_URL ?? new URL(request.url).origin

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
      ui_mode: 'embedded_page',
      mode: 'payment',
      line_items: stripeLineItems,
      return_url: `${appBaseUrl}/share/invoices/${invoice.shareToken}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      metadata: { invoiceId: invoice.id },
      client_reference_id: invoice.id,
    })

    // Store checkout session ID on invoice
    await db
      .update(invoices)
      .set({
        stripeCheckoutSessionId: session.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, id))

    return NextResponse.json({
      ok: true,
      data: { clientSecret: session.client_secret },
    })
  } catch (err) {
    console.error('[api/invoices/checkout] Unhandled error:', err)
    return NextResponse.json(
      { ok: false, error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}
