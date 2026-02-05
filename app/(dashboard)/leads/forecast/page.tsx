import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { AppShellHeader } from '@/components/layout/app-shell'

import { LeadsHeader } from '../_components/leads-header'
import { LeadsTabsNav } from '../_components/leads-tabs-nav'

export const metadata: Metadata = {
  title: 'Forecast | Place to Stand Portal',
}

export default async function ForecastPage() {
  const user = await requireUser()
  assertAdmin(user)

  return (
    <div className='flex h-full min-h-0 flex-col gap-6'>
      <AppShellHeader>
        <LeadsHeader />
      </AppShellHeader>
      <div className='flex min-h-0 flex-1 flex-col gap-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <LeadsTabsNav activeTab='forecast' />
        </div>
        <div className='flex flex-1 items-center justify-center'>
          <div className='text-center'>
            <p className='text-muted-foreground text-sm'>Forecast coming soon</p>
          </div>
        </div>
      </div>
    </div>
  )
}
