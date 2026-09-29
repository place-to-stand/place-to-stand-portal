'use client'

import { useQuery } from '@tanstack/react-query'
import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Landmark,
  Loader2,
  RefreshCw,
} from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@pts/ui/card'
import { cn } from '@/lib/utils'

type MercuryStatus =
  | { status: 'not_configured' }
  | { status: 'error'; message: string; checkedAt: string }
  | {
      status: 'connected'
      checkedAt: string
      accounts: Array<{ id: string; name: string; balance: number }>
    }

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

function EnvName() {
  return (
    <span className='text-foreground/80 font-mono text-xs'>
      MERCURY_API_TOKEN
    </span>
  )
}

/**
 * Company-wide Mercury connection. There is nothing to connect here: the
 * token is an environment variable, so the card only reports whether it
 * works, checked when the page loads.
 */
export function MercuryIntegrationCard() {
  const { data, isLoading, isFetching, refetch, isError } = useQuery({
    queryKey: ['mercuryIntegrationStatus'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/mercury/status')
      if (!res.ok) throw new Error('Failed to check Mercury')
      const body = (await res.json()) as { ok: boolean; data: MercuryStatus }
      return body.data
    },
  })

  const recheck = (
    <Button
      type='button'
      variant='ghost'
      size='icon-sm'
      className='text-muted-foreground'
      aria-label='Check Mercury again'
      disabled={isFetching}
      onClick={() => void refetch()}
    >
      <RefreshCw className={cn(isFetching && 'animate-spin')} />
    </Button>
  )

  return (
    <Card className='gap-4'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Landmark className='size-5' />
          Mercury
        </CardTitle>
        <CardDescription>
          Reads account balances for the monthly close profit share.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        {isLoading ? (
          <div className='flex items-center gap-3 rounded-lg border p-3'>
            <Loader2 className='text-muted-foreground size-5 animate-spin' />
            <span className='text-sm font-medium'>Checking Mercury…</span>
          </div>
        ) : isError || data?.status === 'error' ? (
          <>
            <div className='border-destructive/35 bg-destructive/5 dark:bg-destructive/10 flex items-center justify-between gap-3 rounded-lg border p-3'>
              <div className='flex items-center gap-3'>
                <CircleAlert className='text-destructive size-5 shrink-0' />
                <div className='flex flex-col'>
                  <span className='text-destructive text-sm font-medium'>
                    Unable to reach Mercury
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    {data?.status === 'error'
                      ? data.message
                      : 'The status check failed.'}
                  </span>
                </div>
              </div>
              {recheck}
            </div>
            <p className='text-muted-foreground text-xs'>
              Replace <EnvName /> in Vercel, then redeploy.
            </p>
          </>
        ) : data?.status === 'not_configured' ? (
          <>
            <div className='flex items-center gap-3 rounded-lg border border-dashed p-3'>
              <CircleMinus className='text-muted-foreground size-5 shrink-0' />
              <div className='flex flex-col'>
                <span className='text-sm font-medium'>Not set up</span>
                <span className='text-muted-foreground text-xs'>
                  Profit share is off until a token is added.
                </span>
              </div>
            </div>
            <p className='text-muted-foreground text-xs'>
              Add a read-only <EnvName /> to the internal app in Vercel.
            </p>
          </>
        ) : data?.status === 'connected' ? (
          <>
            <div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
              <div className='flex items-center gap-3'>
                <CircleCheck className='text-success size-5 shrink-0' />
                <div className='flex flex-col'>
                  <span className='text-sm font-medium'>
                    Connected to Mercury
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    {data.accounts.length} account
                    {data.accounts.length === 1 ? '' : 's'} · checked just now
                  </span>
                </div>
              </div>
              {recheck}
            </div>
            {data.accounts.length > 0 ? (
              <div className='overflow-hidden rounded-lg border text-[13px]'>
                <div className='bg-muted/50 text-muted-foreground flex justify-between px-3 py-2 text-xs'>
                  <span>Accounts in the balance</span>
                  <span>Current balance</span>
                </div>
                {data.accounts.map(account => (
                  <div
                    key={account.id}
                    className='flex justify-between border-t px-3 py-2'
                  >
                    <span className='truncate'>{account.name}</span>
                    <span className='tabular-nums'>
                      {money.format(account.balance)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
