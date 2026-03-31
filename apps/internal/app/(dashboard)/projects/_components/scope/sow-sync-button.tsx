'use client'

import { useCallback, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

import { syncSow } from '../../actions/sow'

type SowSyncButtonProps = {
  sowId: string
  onSynced: () => void
}

export function SowSyncButton({ sowId, onSynced }: SowSyncButtonProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const handleSync = useCallback(() => {
    startTransition(async () => {
      const result = await syncSow({ sowId })

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Sync failed', description: result.error })
        return
      }

      toast({
        title: 'SOW synced',
        description: `v${result.data.snapshotVersion} — ${result.data.sectionCount} sections`,
      })
      onSynced()
    })
  }, [sowId, toast, onSynced])

  return (
    <Button
      variant='outline'
      size='sm'
      onClick={handleSync}
      disabled={isPending}
    >
      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
      Sync
    </Button>
  )
}
