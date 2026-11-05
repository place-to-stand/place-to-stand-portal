'use client'

import { useQuery } from '@tanstack/react-query'

import { getJson } from '@/lib/http/get-json'
import type { TaskLeadOption } from '@/lib/types'

export const LEAD_OPTIONS_QUERY_KEY = ['leadOptions'] as const

/** Every live lead, for the task sheet's "Project or lead" picker. */
export function useLeadOptions(enabled: boolean) {
  return useQuery<TaskLeadOption[]>({
    queryKey: LEAD_OPTIONS_QUERY_KEY,
    queryFn: () => getJson<TaskLeadOption[]>('/api/leads/options'),
    enabled,
    // The picker mounts with every task sheet; a short window stops each
    // open from refetching.
    staleTime: 30_000,
  })
}
