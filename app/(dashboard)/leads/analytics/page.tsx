import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { fetchPipelineAnalytics } from '@/lib/data/pipeline'
import { AppShellHeader } from '@/components/layout/app-shell'

import { LeadsHeader } from '../_components/leads-header'
import { LeadsTabsNav } from '../_components/leads-tabs-nav'
import { PipelineDashboard } from '../pipeline/_components/pipeline-dashboard'

export const metadata: Metadata = {
  title: 'Analytics | Place to Stand Portal',
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const user = await requireUser()
  assertAdmin(user)

  const params = await searchParams
  const now = new Date()
  const defaultStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
  const defaultEnd = now.toISOString()

  const start = typeof params.start === 'string' ? params.start : defaultStart
  const end = typeof params.end === 'string' ? params.end : defaultEnd

  const analytics = await fetchPipelineAnalytics(user, start, end)

  return (
    <div className='flex h-full min-h-0 flex-col gap-6'>
      <AppShellHeader>
        <LeadsHeader />
      </AppShellHeader>
      <div className='flex min-h-0 flex-1 flex-col gap-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <LeadsTabsNav activeTab='analytics' />
        </div>
        <PipelineDashboard analytics={analytics} start={start} end={end} />
      </div>
    </div>
  )
}
