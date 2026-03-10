import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { invoices, invoiceLineItems } from '@/lib/db/schema'
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

    // If a checkout session already exists, try to retrieve it
    if (invoice.stripeCheckoutSessionId) {
      try {
        const existingSession = await getStripe().checkout.sessions.retrieve(
          invoice.stripeCheckoutSessionId
        )
        if (existingSession.status === 'open') {
          return NextResponse.json({
            ok: true,
            data: { url: existingSession.url },
          })
        }
      } catch {
        // Session no longer valid, create a new one
      }
    }

    // Fetch line items
    const lineItems = await db
      .select()
      .from(invoiceLineItems)
      .where(
        and(
          eq(invoiceLineItems.invoiceId, id),
          isNull(invoiceLineItems.deletedAt)
        )
      )

    const appBaseUrl =
      process.env.APP_BASE_URL ?? new URL(request.url).origin

    // Build Stripe line items
    const stripeLineItems = lineItems.map(item => {
      const amount = Math.round(Number(item.amount) * 100)
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.description,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }
    })

    // Add tax as separate line item if applicable
    const taxAmount = Number(invoice.taxAmount)
    if (taxAmount > 0) {
      stripeLineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Tax',
          },
          unit_amount: Math.round(taxAmount * 100),
        },
        quantity: 1,
      })
    }

    // Create Stripe Checkout Session
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: stripeLineItems,
      success_url: `${appBaseUrl}/share/invoices/${invoice.shareToken}?payment=success`,
      cancel_url: `${appBaseUrl}/share/invoices/${invoice.shareToken}?payment=cancelled`,
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
      data: { url: session.url },
    })
  } catch (err) {
    console.error('[api/invoices/checkout] Unhandled error:', err)
    return NextResponse.json(
      { ok: false, error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}
