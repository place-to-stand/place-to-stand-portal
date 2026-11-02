'use server'

import { requireCrmUser } from '@/lib/auth/session'
import {
  dashboardLayoutInputSchema,
  defaultLayoutForRole,
  isDefaultDashboardLayout,
  normalizeDashboardLayout,
  type DashboardLayout,
} from '@/lib/dashboard/layout'
import {
  deleteDashboardLayoutRow,
  upsertDashboardLayoutRow,
} from '@/lib/queries/dashboard/layout'

type SaveDashboardLayoutResult =
  | { success: true; layout: DashboardLayout }
  | { success: false; error: string }

/**
 * Persist the viewer's home widget arrangement. The layout is normalized
 * server-side so the client can never store an invalid shape; a layout that
 * matches the default simply drops the row.
 */
export async function saveDashboardLayout(
  input: unknown
): Promise<SaveDashboardLayoutResult> {
  const user = await requireCrmUser()

  if (!dashboardLayoutInputSchema.safeParse(input).success) {
    return { success: false, error: 'Invalid layout.' }
  }

  const layout = normalizeDashboardLayout(input, user.role)

  try {
    if (isDefaultDashboardLayout(layout, user.role)) {
      await deleteDashboardLayoutRow(user.id)
    } else {
      await upsertDashboardLayoutRow(user.id, layout)
    }
  } catch (error) {
    console.error('Failed to save dashboard layout', error)
    return { success: false, error: 'Unable to save layout.' }
  }

  return { success: true, layout }
}

export async function resetDashboardLayout(): Promise<SaveDashboardLayoutResult> {
  const user = await requireCrmUser()

  try {
    await deleteDashboardLayoutRow(user.id)
  } catch (error) {
    console.error('Failed to reset dashboard layout', error)
    return { success: false, error: 'Unable to reset layout.' }
  }

  return {
    success: true,
    layout: defaultLayoutForRole(user.role),
  }
}
