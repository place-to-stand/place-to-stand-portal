'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageSquareText, Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Skeleton } from '@pts/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { LeadRecord, LeadUpdateRecord } from '@/lib/leads/types'

import { LeadUpdateDialog } from './lead-update-dialog'
import { LeadUpdateItem } from './lead-update-item'

type LeadUpdatesSectionProps = {
  lead: LeadRecord
  canManage: boolean
  onSuccess?: () => void
}

export function LeadUpdatesSection({
  lead,
  canManage,
  onSuccess,
}: LeadUpdatesSectionProps) {
  const [updates, setUpdates] = useState<LeadUpdateRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  // The dialog is shared between logging and editing: null = log a new one.
  const [editingUpdate, setEditingUpdate] = useState<LeadUpdateRecord | null>(
    null
  )

  const fetchUpdates = useCallback(() => {
    // Promise-chained (not awaited inline) so every setState runs
    // asynchronously, even when this is called straight from an effect.
    return fetch(`/api/leads/${lead.id}/updates`)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`)
        }
        const data = await response.json()
        setUpdates(data.updates ?? [])
        setLoadFailed(false)
      })
      .catch(error => {
        // Unlike the neighbouring tasks section, a failure here is surfaced:
        // a silent console.error leaves an empty list that reads exactly like
        // "nothing logged yet", which is the opposite of the truth.
        console.error('Failed to fetch lead updates:', error)
        setLoadFailed(true)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [lead.id])

  useEffect(() => {
    fetchUpdates()
  }, [fetchUpdates])

  const openLogDialog = useCallback(() => {
    setEditingUpdate(null)
    setIsDialogOpen(true)
  }, [])

  const openEditDialog = useCallback((update: LeadUpdateRecord) => {
    setEditingUpdate(update)
    setIsDialogOpen(true)
  }, [])

  const handleSaved = useCallback(() => {
    void fetchUpdates()
    onSuccess?.()
  }, [fetchUpdates, onSuccess])

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <MessageSquareText className='text-muted-foreground h-4 w-4' />
          <span className='text-sm font-medium'>Updates</span>
          {updates.length > 0 && (
            <Badge variant='secondary' className='text-xs'>
              {updates.length}
            </Badge>
          )}
        </div>
        {canManage && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={openLogDialog}
          >
            <Plus className='h-3 w-3' />
            Log
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className='space-y-2'>
          <Skeleton className='h-16 w-full' />
          <Skeleton className='h-16 w-full' />
        </div>
      ) : loadFailed ? (
        <div className='space-y-2 rounded-lg border border-dashed p-3'>
          <p className='text-muted-foreground text-sm'>
            Couldn&apos;t load updates.
          </p>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => {
              setIsLoading(true)
              setLoadFailed(false)
              void fetchUpdates()
            }}
          >
            Retry
          </Button>
        </div>
      ) : updates.length === 0 ? (
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm'>
            No interactions logged yet.
          </p>
          {canManage ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={openLogDialog}
            >
              <Plus className='h-3 w-3' />
              Log the first update
            </Button>
          ) : null}
        </div>
      ) : (
        <div className='space-y-2'>
          {updates.map(update => (
            <LeadUpdateItem
              key={update.id}
              update={update}
              canManage={canManage}
              onEdit={openEditDialog}
              onArchived={handleSaved}
            />
          ))}
        </div>
      )}

      <LeadUpdateDialog
        leadId={lead.id}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        update={editingUpdate}
        onSaved={handleSaved}
      />
    </div>
  )
}
