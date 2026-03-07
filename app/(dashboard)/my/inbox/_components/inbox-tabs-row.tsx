'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

import { InboxTabs } from './inbox-tabs'

interface InboxTabsRowProps {
  unclassifiedCount: number
  unclassifiedTranscriptCount?: number
  isAdmin?: boolean
  isConnected: boolean
  lastSyncAt: string | null
}

type ActiveTab = 'triage' | 'emails' | 'transcripts'

export function InboxTabsRow({ unclassifiedCount, unclassifiedTranscriptCount = 0, isAdmin = false, isConnected, lastSyncAt }: InboxTabsRowProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [isSyncing, setIsSyncing] = useState(false)

  const activeTab: ActiveTab = pathname.startsWith('/my/inbox/transcripts')
    ? 'transcripts'
    : pathname.startsWith('/my/inbox/triage')
      ? 'triage'
      : 'emails'

  const syncEmail = useCallback(async () => {
    const res = await fetch('/api/integrations/gmail/sync', { method: 'POST' })
    return res.ok
  }, [])

  const syncTranscripts = useCallback(async () => {
    const res = await fetch('/api/integrations/transcripts/sync', { method: 'POST' })
    return res.ok
  }, [])

  const handleSync = useCallback(async (silent = false) => {
    setIsSyncing(true)
    try {
      if (activeTab === 'transcripts') {
        const ok = await syncTranscripts()
        if (ok) {
          if (!silent) toast({ title: 'Sync complete', description: 'Transcripts synced successfully.' })
          router.refresh()
        }
      } else if (activeTab === 'triage') {
        // Triage: sync emails (blocking) + transcripts (fire-and-forget)
        const ok = await syncEmail()
        syncTranscripts().then(() => router.refresh()).catch(() => {})
        if (ok) {
          if (!silent) toast({ title: 'Sync complete', description: 'Emails synced successfully.' })
          router.refresh()
        }
      } else {
        const ok = await syncEmail()
        if (ok) {
          if (!silent) toast({ title: 'Sync complete', description: 'Emails synced successfully.' })
          router.refresh()
        }
      }
    } catch {
      if (!silent) {
        toast({ title: 'Sync failed', variant: 'destructive' })
      }
    } finally {
      setIsSyncing(false)
    }
  }, [activeTab, syncEmail, syncTranscripts, router, toast])

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
      <InboxTabs
        unclassifiedCount={unclassifiedCount}
        unclassifiedTranscriptCount={unclassifiedTranscriptCount}
        isAdmin={isAdmin}
        className='flex-1 sm:flex-none'
      />

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
