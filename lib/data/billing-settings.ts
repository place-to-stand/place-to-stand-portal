import 'server-only'

import { cache } from 'react'

import {
  fetchBillingSettings,
  type BillingSettings,
} from '@/lib/queries/billing-settings'

/**
 * Cached billing settings fetch, deduped within a single request.
 */
export const fetchCachedBillingSettings = cache(
  async (): Promise<BillingSettings | null> => {
    return fetchBillingSettings()
  }
)
