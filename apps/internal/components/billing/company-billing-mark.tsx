'use client'

import { BillingTypeBadge } from '@/components/billing/billing-type-badge'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import type { ClientBillingTypeValue } from '@/lib/companies/billing/billing-types'

/**
 * Marks a company we bill now, wherever it shows: its Prepaid / Net 30 badge.
 * Billing is admin-only, so everyone else sees nothing.
 */
export function CompanyBillingMark({
  billingType,
  className,
}: {
  billingType: ClientBillingTypeValue | null | undefined
  className?: string
}) {
  const { isAdmin } = useViewerAccess()
  if (!isAdmin || !billingType) return null
  return <BillingTypeBadge billingType={billingType} className={className} />
}
