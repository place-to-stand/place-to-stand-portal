'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageSquareText } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'
import { Skeleton } from '@pts/ui/skeleton'
import { Badge } from '@pts/ui/badge'
import { SectionAddButton } from '@/components/sheets/section-add-button'
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
  // The updates there when the list first loaded; later ones ease in.
  const [initialIds, setInitialIds] = useState<Set<string> | null>(null)
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
        const next: LeadUpdateRecord[] = data.updates ?? []
        // The first load sets what counts as already there.
        setInitialIds(
          previous => previous ?? new Set(next.map(update => update.id))
        )
        setUpdates(next)
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
            <Badge variant='secondary'>{updates.length}</Badge>
          )}
        </div>
        {canManage && (
          <SectionAddButton label='Add update' onClick={openLogDialog} />
        )}
      </div>

      <LeadUpdateDialog
        leadId={lead.id}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        update={editingUpdate}
        onSaved={handleSaved}
      />

      {isLoading ? (
        <div className='space-y-2'>
          <Skeleton className='h-16 w-full' />
          <Skeleton className='h-16 w-full' />
        </div>
      ) : loadFailed ? (
        <EmptyState
          message='Unable to load updates.'
          action={
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
          }
        />
      ) : updates.length === 0 ? (
        <EmptyState
          message='No updates on this lead yet.'
          // Clicking it does what the + does.
          label={canManage ? 'Add update' : undefined}
          onClick={canManage ? openLogDialog : undefined}
        />
      ) : (
        <div className='space-y-2'>
          {updates.map(update => (
            <LeadUpdateItem
              key={update.id}
              // An update logged after the list loaded eases in.
              className={
                initialIds && !initialIds.has(update.id)
                  ? 'animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out motion-reduce:animate-none'
                  : undefined
              }
              update={update}
              canManage={canManage}
              onEdit={openEditDialog}
              onArchived={handleSaved}
            />
          ))}
        </div>
      )}
    </div>
  )
}
