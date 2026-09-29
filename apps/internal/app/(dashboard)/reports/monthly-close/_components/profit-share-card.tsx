'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Landmark, Lock, RefreshCw, TriangleAlert } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { toast } from '@/components/ui/use-toast'
import type { ProfitShareData } from '@/lib/billing/profit-share'
import type { ProfitShareState } from '@/lib/data/reports/types'
import { cn } from '@/lib/utils'

import { addProfitShareAction } from '../actions/add-profit-share'
import {
  formatDay,
  formatDeduction,
  formatMoney,
  formatShortDay,
} from './format'
import { PayeeAvatar } from './payee-avatar'

type ProfitShareCardProps = {
  state: Exclude<ProfitShareState, { status: 'inactive' }>
  year: number
  month: number
  displayMonth: string
  lastDayLabel: string
}

function CardShell({
  total,
  children,
}: {
  total: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby='profit-share-title'
      className='bg-card overflow-hidden rounded-xl border shadow-sm'
    >
      <div className='flex items-center justify-between gap-4 border-b px-5 py-3.5'>
        <div className='flex min-w-0 flex-col gap-0.5'>
          <h2 id='profit-share-title' className='text-base font-semibold'>
            Profit share
          </h2>
          <p className='text-muted-foreground text-xs'>
            Mercury balance after payouts and the minimum, split evenly.
          </p>
        </div>
        <span className='shrink-0 text-base font-semibold tabular-nums'>
          {total}
        </span>
      </div>
      {children}
    </section>
  )
}

function Line({
  label,
  value,
  className,
}: {
  label: React.ReactNode
  value: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3 px-5 py-2 text-sm', className)}>
      <span className='text-foreground/80 flex-1'>{label}</span>
      <span className='tabular-nums'>{value}</span>
    </div>
  )
}

function balanceCaption(
  data: ProfitShareData,
  source: 'live' | 'snapshot'
): string {
  const day = formatShortDay(data.asOfDate)
  if (data.addedAfterCloseAt) return `End of day ${day} · added after close`
  if (source === 'snapshot') return `End of day ${day} · saved at close`
  const accounts = `${data.accounts.length} account${data.accounts.length === 1 ? '' : 's'}`
  return data.monthComplete
    ? `End of day ${day} · ${accounts}`
    : `Today so far · ${accounts}`
}

function ReadyBody({
  data,
  source,
}: {
  data: ProfitShareData
  source: 'live' | 'snapshot'
}) {
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()
  const percent = Math.round(100 / Math.max(data.partners.length, 1))
  const leftAfter = data.balance - data.payouts - data.totalAmount

  return (
    <>
      <div className='flex flex-col py-2'>
        <div className='flex items-center gap-3 px-5 py-2'>
          <div className='bg-muted text-foreground/80 flex size-8 shrink-0 items-center justify-center rounded-md'>
            {source === 'snapshot' ? (
              <Lock className='size-4' />
            ) : (
              <Landmark className='size-4' />
            )}
          </div>
          <div className='flex min-w-0 flex-1 flex-col'>
            <span className='text-sm font-medium'>Mercury balance</span>
            <span className='text-muted-foreground text-xs'>
              {balanceCaption(data, source)}
            </span>
          </div>
          {source === 'live' ? (
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className='text-muted-foreground'
              aria-label='Refresh Mercury balance'
              disabled={isRefreshing}
              onClick={() => startRefresh(() => router.refresh())}
            >
              <RefreshCw className={cn(isRefreshing && 'animate-spin')} />
            </Button>
          ) : null}
          <span className='text-sm font-medium tabular-nums'>
            {formatMoney(data.balance)}
          </span>
        </div>
        {data.accounts.map(account => (
          <div
            key={account.id}
            className='text-muted-foreground flex items-center gap-3 py-1 pr-5 pl-16 text-[13px]'
          >
            <span className='flex-1 truncate'>{account.name}</span>
            <span className='tabular-nums'>{formatMoney(account.balance)}</span>
          </div>
        ))}
        <Line
          className='border-border/50 mt-1 border-t'
          label='Less partner payouts'
          value={formatDeduction(data.payouts)}
        />
        <Line
          label='Less minimum balance'
          value={formatDeduction(data.minimumBalance)}
        />
        <div className='mt-1 flex items-start gap-3 border-t px-5 py-2.5 text-sm'>
          <div className='flex flex-1 flex-col'>
            <span className='font-semibold'>Available to share</span>
            {data.shortfall > 0 ? (
              <span className='text-muted-foreground text-xs tabular-nums'>
                {formatMoney(data.shortfall)} short of the minimum
              </span>
            ) : data.available > data.totalAmount ? (
              <span className='text-muted-foreground text-xs tabular-nums'>
                Split rounds down;{' '}
                {formatMoney(data.available - data.totalAmount)} stays in the
                account
              </span>
            ) : null}
          </div>
          <span className='font-semibold tabular-nums'>
            {formatMoney(data.available)}
          </span>
        </div>
        {data.partners.map(partner => (
          <div
            key={partner.userId}
            className='flex items-center gap-3 px-5 py-1.5 text-sm'
          >
            <PayeeAvatar
              kind='user'
              id={partner.userId}
              name={partner.name}
              avatarUpdatedAt={partner.avatarUpdatedAt}
              size='sm'
            />
            <span className='flex-1 truncate'>{partner.name}</span>
            <span className='text-muted-foreground text-xs tabular-nums'>
              {percent}%
            </span>
            <span className='w-28 text-right tabular-nums'>
              {formatMoney(partner.amount)}
            </span>
          </div>
        ))}
      </div>
      <div className='bg-muted/50 text-foreground/80 flex items-center justify-between gap-3 border-t px-5 py-3 text-[13px]'>
        <span>Balance left after every payout</span>
        <span className='text-foreground font-medium tabular-nums'>
          {formatMoney(leftAfter)}
        </span>
      </div>
      {data.addedAfterCloseAt ? (
        <p className='text-muted-foreground border-t px-5 py-3 text-xs'>
          Added to the close {formatDay(data.addedAfterCloseAt)}, after the
          month was closed.
        </p>
      ) : null}
    </>
  )
}

function UnavailableBody({ message }: { message: string }) {
  const router = useRouter()
  const [isRetrying, startRetry] = useTransition()

  return (
    <div className='flex flex-col gap-3 p-5'>
      <div className='flex items-start gap-2.5'>
        <TriangleAlert className='text-destructive mt-0.5 size-4 shrink-0' />
        <div className='flex flex-col gap-0.5'>
          <span className='text-sm font-medium'>
            Unable to load Mercury balance
          </span>
          <span className='text-muted-foreground text-[13px]'>
            {message} Profit share can&apos;t be worked out until the balance
            loads.
          </span>
        </div>
      </div>
      <div className='flex gap-2 pl-6'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={isRetrying}
          onClick={() => startRetry(() => router.refresh())}
        >
          <RefreshCw className={cn(isRetrying && 'animate-spin')} />
          Retry
        </Button>
        <Button variant='ghost' size='sm' asChild>
          <Link href='/settings/integrations'>Open integrations</Link>
        </Button>
      </div>
    </div>
  )
}

function NotSavedBody({
  year,
  month,
  displayMonth,
  lastDayLabel,
}: Omit<ProfitShareCardProps, 'state'>) {
  const [isPending, startTransition] = useTransition()

  const add = () =>
    startTransition(async () => {
      const result = await addProfitShareAction({ year, month })
      if (result.error) {
        toast({
          title: 'Unable to add profit share',
          description: result.error,
          variant: 'destructive',
        })
      } else {
        toast({ title: `Profit share added to ${displayMonth}` })
      }
    })

  return (
    <div className='flex flex-col items-start gap-3 p-5'>
      <p className='text-muted-foreground text-sm'>
        {displayMonth} was closed before profit share was tracked. Adding it
        reads the {lastDayLabel} Mercury balance and uses the payouts saved in
        this close.
      </p>
      <Button
        type='button'
        variant='outline'
        disabled={isPending}
        onClick={add}
      >
        <Landmark />
        {isPending ? 'Adding…' : `Add ${lastDayLabel} balance`}
      </Button>
    </div>
  )
}

export function ProfitShareCard(props: ProfitShareCardProps) {
  const { state } = props

  if (state.status === 'ready') {
    return (
      <CardShell total={formatMoney(state.data.totalAmount)}>
        <ReadyBody data={state.data} source={state.source} />
      </CardShell>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <CardShell total='—'>
        <UnavailableBody message={state.message} />
      </CardShell>
    )
  }

  return (
    <CardShell total='—'>
      <NotSavedBody {...props} />
    </CardShell>
  )
}
