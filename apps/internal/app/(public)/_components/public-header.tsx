import type { ReactNode } from 'react'

import { BrandLogo } from '@pts/portal-ui/brand'

import { brandPropsFor, getBusinessIdentity } from '@/lib/business/identity'

/** Logo left, page context (a mono tag) right — the marketing header, minus nav. */
export async function PublicHeader({ children }: { children?: ReactNode }) {
  const brand = brandPropsFor(await getBusinessIdentity())
  return (
    <header className='border-brand-border bg-brand-bg/90 border-b'>
      <div className='mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-6 sm:py-4 lg:px-12'>
        <BrandLogo size='md' tone='brand' className='sm:hidden' {...brand} />
        <BrandLogo
          size='lg'
          tone='brand'
          className='hidden sm:inline-flex'
          {...brand}
        />
        {children}
      </div>
    </header>
  )
}
