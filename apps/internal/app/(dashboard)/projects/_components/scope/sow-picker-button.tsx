'use client'

import { useCallback } from 'react'
import { FileText, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

import { linkSows } from '../../actions/sow'
import { useGooglePicker } from './use-google-picker'

type SowPickerButtonProps = {
  projectId: string
  variant: 'empty-state' | 'header'
  onLinked: () => void
}

export function SowPickerButton({
  projectId,
  variant,
  onLinked,
}: SowPickerButtonProps) {
  const { toast } = useToast()

  const handlePicked = useCallback(
    async (docs: Array<{ id: string; name: string; url: string }>) => {
      const result = await linkSows({
        projectId,
        documents: docs.map(doc => ({
          googleDocId: doc.id,
          googleDocTitle: doc.name,
          googleDocUrl: doc.url,
        })),
      })

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }

      const { linked, skipped } = result.data
      const parts: string[] = []
      if (linked > 0) parts.push(`${linked} linked`)
      if (skipped > 0) parts.push(`${skipped} skipped`)
      toast({ title: 'SOWs updated', description: parts.join(', ') })
      onLinked()
    },
    [projectId, toast, onLinked]
  )

  const { openPicker, isLoading, error } = useGooglePicker({
    onPicked: handlePicked,
  })

  if (variant === 'empty-state') {
    return (
      <div className='flex flex-1 flex-col items-center justify-center gap-4 p-8'>
        <div className='bg-muted/50 flex h-16 w-16 items-center justify-center rounded-full'>
          <FileText className='text-muted-foreground h-8 w-8' />
        </div>
        <div className='text-center'>
          <p className='text-sm font-medium'>No SOW linked</p>
          <p className='text-muted-foreground mt-1 text-xs'>
            Link a Statement of Work from Google Drive to track project scope.
          </p>
        </div>
        <Button onClick={openPicker} disabled={isLoading} size='sm'>
          <Plus className='mr-1 h-4 w-4' />
          {isLoading ? 'Opening...' : 'Link SOW from Drive'}
        </Button>
        {error && <p className='text-destructive text-xs'>{error}</p>}
      </div>
    )
  }

  return (
    <Button onClick={openPicker} disabled={isLoading} variant='outline' size='sm'>
      <Plus className='mr-1 h-3 w-3' />
      {isLoading ? 'Opening...' : 'Link SOW'}
    </Button>
  )
}
