'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

import { InboxTabs } from './inbox-tabs'

interface InboxTabsRowProps {
  unclassifiedCount: number
  isConnected: boolean
  lastSyncAt: string | null
}

export function InboxTabsRow({ unclassifiedCount, isConnected, lastSyncAt }: InboxTabsRowProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = useCallback(async (silent = false) => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/integrations/gmail/sync', {
        method: 'POST',
      })
      if (res.ok) {
        if (!silent) {
          toast({
            title: 'Sync complete',
            description: 'Emails synced successfully.',
          })
        }
        router.refresh()
      }
    } catch {
      if (!silent) {
        toast({ title: 'Sync failed', variant: 'destructive' })
      }
    } finally {
      setIsSyncing(false)
    }
  }, [router, toast])

  // Auto-sync on mount and poll every 60s
  const hasSyncedRef = useRef(false)
  useEffect(() => {
    if (!isConnected) return

    if (!hasSyncedRef.current) {
      hasSyncedRef.current = true
      handleSync(true)
    }

    const interval = setInterval(() => {
      handleSync(true)
    }, 60_000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected])

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
      <InboxTabs unclassifiedCount={unclassifiedCount} className='flex-1 sm:flex-none' />

      {isConnected && (
        <div className='flex items-center gap-4'>
          {lastSyncAt && (
            <span className='text-muted-foreground text-sm whitespace-nowrap'>
              Last sync{' '}
              {formatDistanceToNow(new Date(lastSyncAt))} ago
            </span>
          )}
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleSync()}
            disabled={isSyncing}
          >
            <RefreshCw
              className={cn('h-4 w-4', isSyncing && 'animate-spin')}
            />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </Button>
        </div>
      )}
    </div>
  )
}
