'use client'

import { BillingTypeBadge } from '@/components/billing/billing-type-badge'
import { StatCard } from '@/components/ui/stat-card'

import { DesignSection, Specimen } from './specimen'

export function ComponentsStats() {
  return (
    <DesignSection
      id='stats'
      title='Stat cards and billing badge'
      when='A pair of figures side by side (the time log dialog’s project and client hours); a client’s billing type next to its name.'
    >
      <Specimen
        label='StatCard'
        note='components/ui/stat-card.tsx: the label above, the figure below; tone="negative" for a figure under zero'
        className='block'
      >
        <div className='grid max-w-md grid-cols-2 gap-3'>
          <StatCard label='Project this month' value='5.75h' />
          <StatCard label='Client remaining' value='-1.5h' tone='negative' />
        </div>
      </Specimen>
      <Specimen
        label='BillingTypeBadge'
        note='components/billing/billing-type-badge.tsx'
      >
        <BillingTypeBadge billingType='net_30' />
        <BillingTypeBadge billingType='prepaid' />
      </Specimen>
    </DesignSection>
  )
}
