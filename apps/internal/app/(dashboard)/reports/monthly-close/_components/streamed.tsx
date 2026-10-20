import { Skeleton } from '@pts/ui/skeleton'

import type { CloseDrift } from '@/lib/data/reports/close'
import type { StripeFeesState } from '@/lib/stripe/fees'

import { DriftNotice } from './drift-notice'
import { StripeFeesCard } from './stripe-fees-card'

// Cards fed by an outside API stream in behind a Suspense boundary, so the
// database-backed report never waits on Stripe or Mercury. The page starts
// each request before it awaits anything and passes the promise down.

export async function StreamedDriftNotice({
  drift,
  ...props
}: {
  drift: Promise<CloseDrift | null>
  year: number
  month: number
  displayMonth: string
}) {
  const resolved = await drift
  return resolved?.hasDrift ? <DriftNotice drift={resolved} {...props} /> : null
}

export async function StreamedStripeFeesCard({
  state,
  ...props
}: {
  state: Promise<StripeFeesState>
  entryDate: string
  monthLabel: string
  inProgress?: boolean
}) {
  return <StripeFeesCard state={await state} {...props} />
}

/** Holds the Stripe fees card's frame while Stripe answers. */
export function StripeFeesCardSkeleton() {
  return (
    <section
      aria-label='Stripe fees'
      aria-busy
      className='bg-card overflow-hidden rounded-xl border shadow-sm'
    >
      <div className='flex items-center justify-between gap-4 border-b px-5 py-3.5'>
        <span className='text-base font-semibold'>Stripe fees</span>
        <Skeleton className='h-5 w-16' />
      </div>
      <div className='space-y-2.5 px-5 py-4'>
        <Skeleton className='h-4 w-3/4' />
        <Skeleton className='h-4 w-1/2' />
        <Skeleton className='h-4 w-2/3' />
      </div>
    </section>
  )
}
