import 'server-only'

import { cache } from 'react'

import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import {
  fetchLeadStatusCounts,
  fetchConversionCounts,
  fetchRevenueMetrics,
  fetchVelocityMetrics,
  fetchActivityMetrics,
} from '@/lib/queries/pipeline'

import type { PipelineAnalytics, FunnelData } from './types'

export const fetchPipelineAnalytics = cache(
  async (
    user: AppUser,
    start: string,
    end: string
  ): Promise<PipelineAnalytics> => {
    assertAdmin(user)

    const [statusCounts, conversions, revenue, velocity, activity] =
      await Promise.all([
        fetchLeadStatusCounts(),
        fetchConversionCounts(start, end),
        fetchRevenueMetrics(start, end),
        fetchVelocityMetrics(start, end),
        fetchActivityMetrics(start, end),
      ])

    return {
      funnel: {
        statusCounts: statusCounts.map(r => ({
          status: r.status,
          count: r.count,
        })),
        conversions: conversions.map(r => ({
          fromStatus: r.fromStatus,
          toStatus: r.toStatus,
          count: r.count,
        })),
      },
      revenue,
      velocity,
      activity,
    }
  }
)

export type { PipelineAnalytics, FunnelData }
