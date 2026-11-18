'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LifeBuoy } from 'lucide-react'

import { Button } from '@pts/ui/button'

/**
 * Help in the page header, beside Notifications and drawn the same way.
 * Opens Help → Get help; the reference pages are tabs there.
 */
export function HelpButton() {
  const pathname = usePathname()
  const current = pathname === '/help' || pathname.startsWith('/help/')

  return (
    <Button
      asChild
      variant='outline'
      // xs matches the Notifications button, so the header keeps its height.
      size='xs'
      className='has-[>svg]:px-2 [&_svg]:size-3.5'
    >
      <Link
        href='/help'
        aria-label='Help'
        aria-current={current ? 'page' : undefined}
      >
        <LifeBuoy aria-hidden />
        <span className='hidden sm:inline'>Help</span>
      </Link>
    </Button>
  )
}
