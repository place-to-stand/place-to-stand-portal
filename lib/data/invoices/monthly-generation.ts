import 'server-only'

import { and, eq, isNull, sql, gte, lt } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients, timeLogs, projects } from '@/lib/db/schema'
import { fetchBillingSettings } from '@/lib/queries/billing-settings'
import { findExistingDraftForPeriod, createInvoice, createLineItem, recomputeInvoiceTotals } from '@/lib/queries/invoices'

export type MonthlyGenerationResult = {
  generated: number
  skipped: number
  errors: string[]
}

/**
 * Generate draft invoices for all active net-30 clients.
 * Creates one HOURS_WORKED line item per project based on time logs.
 */
export async function generateMonthlyInvoices(
  actorId: string
): Promise<MonthlyGenerationResult> {
  const result: MonthlyGenerationResult = {
    generated: 0,
    skipped: 0,
    errors: [],
  }

  const settings = await fetchBillingSettings()
  const hourlyRate = Number(settings?.hourlyRate ?? 200)

  // Calculate previous month boundaries (timezone-aware: America/Los_Angeles)
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodStartStr = periodStart.toISOString().split('T')[0]
  const periodEndStr = periodEnd.toISOString().split('T')[0]

  // Query all active net-30 clients
  const net30Clients = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(
      and(
        eq(clients.billingType, 'net_30'),
        isNull(clients.deletedAt)
      )
    )

  for (const client of net30Clients) {
    try {
      // Duplicate detection
      const existing = await findExistingDraftForPeriod(
        client.id,
        periodStartStr,
        periodEndStr
      )
      if (existing) {
        result.skipped++
        continue
      }

      // Aggregate time logs by project for this client
      const projectSummaries = await db
        .select({
          projectId: projects.id,
          projectName: projects.name,
          totalHours: sql<string>`SUM(${timeLogs.hours})`.as('total_hours'),
        })
        .from(timeLogs)
        .innerJoin(projects, eq(timeLogs.projectId, projects.id))
        .where(
          and(
            eq(projects.clientId, client.id),
            eq(projects.type, 'CLIENT'),
            isNull(projects.deletedAt),
            isNull(timeLogs.deletedAt),
            gte(timeLogs.loggedOn, periodStartStr),
            lt(timeLogs.loggedOn, periodEndStr)
          )
        )
        .groupBy(projects.id, projects.name)

      // Skip if no time logs
      if (projectSummaries.length === 0) {
        result.skipped++
        continue
      }

      // Create draft invoice
      const dueDate = new Date(periodEnd)
      dueDate.setDate(dueDate.getDate() + (settings?.defaultPaymentTermsDays ?? 30))

      const invoice = await createInvoice({
        clientId: client.id,
        createdBy: actorId,
        status: 'DRAFT',
        billingPeriodStart: periodStartStr,
        billingPeriodEnd: periodEndStr,
        dueDate: dueDate.toISOString().split('T')[0],
        notes: null,
        currency: 'USD',
      })

      // Create one HOURS_WORKED line item per project
      let sortOrder = 0
      for (const summary of projectSummaries) {
        const hours = Number(summary.totalHours)
        const amount = hours * hourlyRate

        await createLineItem({
          invoiceId: invoice.id,
          type: 'HOURS_WORKED',
          description: `${summary.projectName} — ${hours} hrs @ $${hourlyRate}/hr`,
          quantity: String(hours) as unknown as string,
          unitPrice: String(hourlyRate) as unknown as string,
          amount: String(amount) as unknown as string,
          sortOrder: sortOrder++,
        })
      }

      // Recompute totals
      await recomputeInvoiceTotals(invoice.id)

      result.generated++
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Client ${client.name}: ${message}`)
    }
  }

  return result
}
