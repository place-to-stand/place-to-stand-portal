import { NextRequest, NextResponse } from 'next/server'

import { generateMonthlyInvoices } from '@/lib/data/invoices/monthly-generation'
import { logActivity } from '@/lib/activity/logger'
import { monthlyInvoicesGeneratedEvent } from '@/lib/activity/events/invoices'

/**
 * Monthly invoice generation cron endpoint.
 * Generates draft invoices for all active net-30 clients.
 *
 * Schedule: "0 10 1 * *" (1st of month, 10:00 UTC)
 * Auth: Bearer token (CRON_SECRET)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Use a system actor ID (the cron doesn't have a user session)
    // We'll use the first admin user or a placeholder
    const { db } = await import('@/lib/db')
    const { users } = await import('@/lib/db/schema')
    const { eq, isNull, and } = await import('drizzle-orm')

    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'ADMIN'), isNull(users.deletedAt)))
      .limit(1)

    if (!admin) {
      return NextResponse.json(
        { error: 'No admin user found' },
        { status: 500 }
      )
    }

    const result = await generateMonthlyInvoices(admin.id)

    // Log activity if invoices were generated
    if (result.generated > 0) {
      const event = monthlyInvoicesGeneratedEvent({
        count: result.generated,
        totalValue: 0, // Could compute from generated invoices
      })
      logActivity({
        actorId: admin.id,
        verb: event.verb,
        summary: event.summary,
        targetType: 'INVOICE',
        metadata: event.metadata,
      }).catch(err =>
        console.error('[cron/monthly-invoices] Failed to log activity:', err)
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[cron/monthly-invoices] Error:', error)
    return NextResponse.json(
      { error: 'Monthly invoice generation failed' },
      { status: 500 }
    )
  }
}
