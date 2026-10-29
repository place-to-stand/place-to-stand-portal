import 'server-only'

import { cache } from 'react'

import type { AppUser } from '@/lib/auth/session'
import {
  DEFAULT_DASHBOARD_LAYOUTS,
  cloneLayout,
  dashboardKindForRole,
  normalizeDashboardLayout,
  type DashboardLayout,
} from '@/lib/dashboard/layout'
import { fetchDashboardLayoutRow } from '@/lib/queries/dashboard/layout'

/** The viewer's saved home layout, or the default when none is stored. */
export const fetchDashboardLayout = cache(
  async (user: AppUser): Promise<DashboardLayout> => {
    const kind = dashboardKindForRole(user.role)
    const row = await fetchDashboardLayoutRow(user.id)
    if (!row) {
      return cloneLayout(DEFAULT_DASHBOARD_LAYOUTS[kind])
    }
    return normalizeDashboardLayout(row.layout, kind)
  }
)
