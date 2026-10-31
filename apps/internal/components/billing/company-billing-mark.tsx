'use client'

import { Check } from 'lucide-react'

import { BillingTypeBadge } from '@/components/billing/billing-type-badge'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import type { ClientBillingTypeValue } from '@/lib/companies/billing/billing-types'
import { ENTITY_ACCENTS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

/**
 * Marks a company we bill now, wherever it shows: its Prepaid / Net 30 badge
 * for people who see billing (admins), else a green check. Render it only
 * for a client company.
 */
export function CompanyBillingMark({
  billingType,
  className,
}: {
  billingType: ClientBillingTypeValue | null | undefined
  className?: string
}) {
  const { isAdmin } = useViewerAccess()
  if (isAdmin && billingType) {
    return <BillingTypeBadge billingType={billingType} className={className} />
  }
  return (
    <Check
      className={cn(
        ENTITY_ACCENTS.client.icon,
        'inline size-4 shrink-0',
        className
      )}
      aria-label='Billed now'
    />
  )
}
