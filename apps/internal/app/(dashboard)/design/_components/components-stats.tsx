'use client'

import { TimeLogInfoView } from '@/app/(dashboard)/projects/_components/project-time-log/time-log-hours-summary'

import { BillingTypeBadge } from '@/components/billing/billing-type-badge'
import {
  InfoPanel,
  InfoPanelBody,
  InfoPanelStats,
  InfoPanelDivider,
} from '@/components/ui/info-panel'
import { StatCard } from '@/components/ui/stat-card'

import { DesignSection, Specimen } from './specimen'

export function ComponentsStats() {
  return (
    <DesignSection
      id='stats'
      title='Stat cards, info panel and billing badge'
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
        label='InfoPanel'
        note='components/ui/info-panel.tsx: read-only context above a form; flat, no border, figures split by hairlines; then InfoPanelDivider'
        className='block'
      >
        <InfoPanel className='max-w-md'>
          <InfoPanelBody>
            <span className='flex items-center gap-2'>
              The Rounds <BillingTypeBadge billingType='prepaid' />
            </span>
            <span>Shopify Store</span>
          </InfoPanelBody>
          <InfoPanelStats
            stats={[
              { label: 'Project logged', value: '34h' },
              { label: 'Client remaining', value: '0.5h' },
            ]}
          />
        </InfoPanel>
      </Specimen>
      {/* TEMPORARY comparison for the time log dialog: drop with its commit. */}
      <Specimen
        label='Time log context: panel vs header band (comparison)'
        note='Current panel on the left; the alternate band on the right. In the app (local dev), open a time log and use the Panel / Band switch by its title.'
        className='block'
      >
        <div className='grid gap-6 lg:grid-cols-2'>
          {(['panel', 'band'] as const).map(variant => (
            <div
              key={variant}
              className='bg-background grid gap-4 overflow-hidden rounded-lg border p-6 shadow-sm'
            >
              <p className='text-lg font-semibold'>Create time log</p>
              <TimeLogInfoView
                variant={variant}
                clientName='The Rounds'
                billingType='prepaid'
                projectName='Shopify Store'
                stats={[
                  { label: 'Project logged', value: '34h' },
                  { label: 'Client remaining', value: '0.5h' },
                ]}
              />
              {variant === 'panel' ? <InfoPanelDivider /> : null}
              <div className='text-muted-foreground grid gap-2 text-sm'>
                <span className='text-foreground font-medium'>Hours</span>
                <div className='h-9 rounded-md border' />
              </div>
            </div>
          ))}
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
