'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IdCard } from 'lucide-react'

import { Button } from '@placetostand/ui/button'

/**
 * Shown to admins until someone saves Settings → Business: until then,
 * emails, invoices and share pages carry no address, phone, website or
 * inbox for replies. A full-width strip above the page header, not a card,
 * so the header stays the first thing on the page; hidden on Settings,
 * where the form itself is the fix.
 */
export function BusinessSetupBanner() {
  const pathname = usePathname()
  if (pathname.startsWith('/settings')) return null
  return (
    <div className='bg-background text-muted-foreground flex items-center gap-2 border-b px-3 py-1.5 text-sm sm:px-4'>
      <IdCard className='size-4 shrink-0' aria-hidden />
      <p className='min-w-0 flex-1 truncate'>
        <span className='text-foreground font-medium'>
          Business details missing.
        </span>
        <span className='max-sm:hidden'>
          {' '}
          Emails and invoices show no address, website or reply inbox.
        </span>
      </p>
      <Button asChild size='xs' variant='outline' className='shrink-0'>
        <Link href='/settings/business'>Add details</Link>
      </Button>
    </div>
  )
}
