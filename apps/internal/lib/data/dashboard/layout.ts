import 'server-only'

import { cache } from 'react'

import type { AppUser } from '@/lib/auth/session'
import {
  DEFAULT_DASHBOARD_LAYOUT,
  cloneLayout,
  normalizeDashboardLayout,
  type DashboardLayout,
} from '@/lib/dashboard/layout'
import { fetchDashboardLayoutRow } from '@/lib/queries/dashboard/layout'

/** The viewer's saved home layout, or the default when none is stored. */
export const fetchDashboardLayout = cache(
  async (user: AppUser): Promise<DashboardLayout> => {
    const row = await fetchDashboardLayoutRow(user.id)
    if (!row) {
      return cloneLayout(DEFAULT_DASHBOARD_LAYOUT)
    }
    return normalizeDashboardLayout(row.layout)
  }
)
