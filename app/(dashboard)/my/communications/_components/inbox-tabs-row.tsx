'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

import { InboxTabs } from './inbox-tabs'

interface InboxTabsRowProps {
  unclassifiedCount: number
  unclassifiedTranscriptCount?: number
  isConnected: boolean
  lastSyncAt: string | null
  showTranscriptsTab?: boolean
}

export function InboxTabsRow({ unclassifiedCount, unclassifiedTranscriptCount = 0, isConnected, lastSyncAt, showTranscriptsTab = true }: InboxTabsRowProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSyncing, setIsSyncing] = useState(false)
  const [isCtrlHeld, setIsCtrlHeld] = useState(false)

  // Track Ctrl/Meta key state for full sync mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlHeld(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlHeld(false)
    }
    const handleBlur = () => setIsCtrlHeld(false)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  const handleSync = useCallback(async (silent = false, full = false) => {
    setIsSyncing(true)
    try {
      const qs = full ? '?full=1' : ''
      const [emailRes, transcriptRes] = await Promise.all([
        fetch(`/api/integrations/gmail/sync${qs}`, { method: 'POST' }),
        fetch(`/api/integrations/transcripts/sync${qs}`, { method: 'POST' }),
      ])
      if (emailRes.ok || transcriptRes.ok) {
        if (!silent) {
          const emailData = emailRes.ok ? await emailRes.json().catch(() => null) : null
          const transcriptData = transcriptRes.ok ? await transcriptRes.json().catch(() => null) : null

          const emailSynced = emailData?.synced ?? 0
          const emailSkipped = emailData?.skipped ?? 0
          // Transcript sync returns { created, updated, discovered, skipped }
          const transcriptCreated = transcriptData?.created ?? 0
          const transcriptDiscovered = transcriptData?.discovered ?? 0

          const parts: string[] = []
          if (emailSynced > 0) parts.push(`${emailSynced} new email${emailSynced === 1 ? '' : 's'}`)
          if (transcriptCreated > 0) parts.push(`${transcriptCreated} new transcript${transcriptCreated === 1 ? '' : 's'}`)

          const upToDate = emailSkipped + (transcriptDiscovered - transcriptCreated)
          const description = parts.length > 0
            ? `Synced ${parts.join(' and ')}.${upToDate > 0 ? ` ${upToDate} already up to date.` : ''}`
            : 'Everything is up to date.'

          toast({
            title: full ? 'Full sync complete' : 'Sync complete',
            description,
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

  // Background polling is handled globally by BackgroundSync in the dashboard layout.
  // This component only handles manual sync (button click).

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
      <InboxTabs
        unclassifiedCount={unclassifiedCount}
        unclassifiedTranscriptCount={unclassifiedTranscriptCount}
        showTranscriptsTab={showTranscriptsTab}
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
            onClick={() => handleSync(false, isCtrlHeld)}
            disabled={isSyncing}
          >
            <RefreshCw
              className={cn('h-4 w-4', isSyncing && 'animate-spin')}
            />
            {isSyncing
              ? 'Syncing...'
              : isCtrlHeld
                ? 'Full Sync'
                : 'Sync'}
          </Button>
        </div>
      )}
    </div>
  )
}
