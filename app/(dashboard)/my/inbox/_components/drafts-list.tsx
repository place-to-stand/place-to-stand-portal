'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { FileEdit, Trash2, RefreshCw, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

import type { ComposeContext } from './compose-panel'

type Draft = {
  id: string
  composeType: string
  toEmails: string[]
  subject: string | null
  bodyText: string | null
  status: string
  scheduledAt: string | null
  updatedAt: string
}

interface DraftsListProps {
  onResumeDraft: (context: ComposeContext) => void
}

export function DraftsList({ onResumeDraft }: DraftsListProps) {
  const { toast } = useToast()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadDrafts = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/integrations/gmail/drafts')
      if (res.ok) {
        const data = await res.json()
        // Filter to only show composing drafts (not sent/failed)
        const activeDrafts = (data.drafts || []).filter(
          (d: Draft) => d.status === 'COMPOSING' || d.status === 'READY'
        )
        setDrafts(activeDrafts)
      }
    } catch (err) {
      console.error('Failed to load drafts:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDrafts()
  }, [loadDrafts])

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/integrations/gmail/drafts/${deleteId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setDrafts(prev => prev.filter(d => d.id !== deleteId))
        toast({ title: 'Draft deleted' })
      } else {
        throw new Error('Failed to delete')
      }
    } catch {
      toast({
        title: 'Failed to delete draft',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  const handleResume = (draft: Draft) => {
    onResumeDraft({
      mode: draft.composeType as 'new' | 'reply' | 'reply_all' | 'forward',
      draftId: draft.id,
      to: draft.toEmails,
      subject: draft.subject || undefined,
      quotedBody: undefined, // Don't re-quote on resume
    })
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <RefreshCw className='text-muted-foreground h-5 w-5 animate-spin' />
      </div>
    )
  }

  if (drafts.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-8 text-center'>
        <Mail className='text-muted-foreground mb-2 h-8 w-8' />
        <p className='text-muted-foreground text-sm'>No drafts</p>
      </div>
    )
  }

  return (
    <>
      <div className='divide-y'>
        {drafts.map(draft => (
          <div
            key={draft.id}
            className='hover:bg-muted/50 flex items-start justify-between gap-3 p-3'
          >
            <button
              type='button'
              onClick={() => handleResume(draft)}
              className='min-w-0 flex-1 text-left'
            >
              <div className='flex items-center gap-2'>
                <FileEdit className='text-muted-foreground h-4 w-4 flex-shrink-0' />
                <span className='truncate font-medium'>
                  {draft.subject || '(no subject)'}
                </span>
              </div>
              <div className='text-muted-foreground mt-1 truncate text-xs'>
                To: {draft.toEmails.join(', ') || '(no recipients)'}
              </div>
              <div className='text-muted-foreground mt-1 text-xs'>
                {formatDistanceToNow(new Date(draft.updatedAt))} ago
                {draft.scheduledAt && (
                  <span className='ml-2 text-amber-600'>
                    Scheduled
                  </span>
                )}
              </div>
            </button>
            <Button
              variant='ghost'
              size='icon'
              className='text-muted-foreground hover:text-destructive h-8 w-8 flex-shrink-0'
              onClick={() => setDeleteId(draft.id)}
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete draft?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The draft will be permanently
              deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setDeleteId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
