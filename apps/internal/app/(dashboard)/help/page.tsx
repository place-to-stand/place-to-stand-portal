import type { Metadata } from 'next'
import { ArrowUpRight, Mail } from 'lucide-react'

import { BrandLogo } from '@pts/ui/brand'
import { Button } from '@pts/ui/button'
import { PagePanel } from '@/components/layout/page-panel'
import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { PTS_CONTACT } from '@/lib/help/pts-contact'

import { helpCrumbs, helpTabsFor } from './_lib/tabs'

export const metadata: Metadata = {
  title: 'Get help | Help',
}

/**
 * Help → Get help: who built the portal and how to reach them. The card is
 * fixed (`PTS_CONTACT`), so it reads the same on every install whatever the
 * business set on Settings → Business.
 */
export default async function GetHelpPage() {
  const user = await requirePage('portal.sign_in')
  const host = new URL(PTS_CONTACT.website).host

  return (
    <PageShell
      breadcrumbs={helpCrumbs('get-help')}
      tabs={helpTabsFor(user.role)}
      activeTab='get-help'
    >
      <PagePanel className='flex max-w-2xl flex-col gap-6'>
        <BrandLogo size='lg' />
        <div className='flex flex-col gap-2'>
          <h1 className='text-lg font-semibold'>Built by {PTS_CONTACT.name}</h1>
          <p className='text-muted-foreground text-base'>
            We build the systems behind your business and the stores in front of
            it. Want something in this portal changed, added or set up? Talk to
            the engineers who built it.
          </p>
        </div>
        <div className='flex flex-wrap gap-3'>
          <Button asChild>
            <a href={PTS_CONTACT.bookingUrl} target='_blank' rel='noreferrer'>
              Book a call
              <ArrowUpRight aria-hidden />
            </a>
          </Button>
          <Button asChild variant='outline'>
            <a href={`mailto:${PTS_CONTACT.email}`}>
              <Mail aria-hidden />
              {PTS_CONTACT.email}
            </a>
          </Button>
          <Button asChild variant='outline'>
            <a href={PTS_CONTACT.website} target='_blank' rel='noreferrer'>
              {host}
              <ArrowUpRight aria-hidden />
            </a>
          </Button>
        </div>
      </PagePanel>
    </PageShell>
  )
}
