import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { userDashboardLayouts } from '@/lib/db/schema'
import type { DashboardLayout } from '@/lib/dashboard/layout'

export async function fetchDashboardLayoutRow(userId: string) {
  const [row] = await db
    .select({ layout: userDashboardLayouts.layout })
    .from(userDashboardLayouts)
    .where(eq(userDashboardLayouts.userId, userId))
    .limit(1)
  return row ?? null
}

export async function upsertDashboardLayoutRow(
  userId: string,
  layout: DashboardLayout
) {
  const now = new Date().toISOString()
  await db
    .insert(userDashboardLayouts)
    .values({ userId, layout, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: userDashboardLayouts.userId,
      set: { layout, updatedAt: now },
    })
}

export async function deleteDashboardLayoutRow(userId: string) {
  await db
    .delete(userDashboardLayouts)
    .where(eq(userDashboardLayouts.userId, userId))
}
