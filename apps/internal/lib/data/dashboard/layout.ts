import 'server-only'

import { cache } from 'react'

import type { AppUser } from '@/lib/auth/session'
import {
  defaultLayoutForRole,
  normalizeDashboardLayout,
  type DashboardLayout,
} from '@/lib/dashboard/layout'
import { fetchDashboardLayoutRow } from '@/lib/queries/dashboard/layout'

/** The viewer's saved home layout, or the default when none is stored. */
export const fetchDashboardLayout = cache(
  async (user: AppUser): Promise<DashboardLayout> => {
    const row = await fetchDashboardLayoutRow(user.id)
    if (!row) {
      return defaultLayoutForRole(user.role)
    }
    return normalizeDashboardLayout(row.layout, user.role)
  }
)
