'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquareText } from 'lucide-react'

import { Button } from '@placetostand/ui/button'
import { EmptyState } from '@placetostand/ui/empty-state'
import { Skeleton } from '@placetostand/ui/skeleton'
import { Badge } from '@placetostand/ui/badge'
import { EntityList } from '@/components/sheets/entity-list'
import type { LeadRecord, LeadUpdateRecord } from '@/lib/leads/types'

import { LeadUpdateDialog, type DiscardGuard } from './lead-update-dialog'
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
    // fetchUpdates catches and reports its own errors.
    void fetchUpdates()
  }, [fetchUpdates])

  // The heading's X bumps this; the form closes as if Cancel was clicked.
  const [closeRequest, setCloseRequest] = useState(0)

  // Each open form's "ask before dropping my changes": the new-update form
  // and the one update being edited. Switching forms asks the one it drops.
  const newFormGuard = useRef<DiscardGuard | null>(null)
  const editFormGuard = useRef<DiscardGuard | null>(null)

  const openLogDialog = useCallback(() => {
    const open = () => {
      setEditingUpdate(null)
      setIsDialogOpen(true)
    }
    if (editFormGuard.current) editFormGuard.current(open)
    else open()
  }, [])

  // Editing happens in place: the card turns into the form where it sits.
  const openEditDialog = useCallback((update: LeadUpdateRecord) => {
    const edit = () => {
      setIsDialogOpen(false)
      setEditingUpdate(update)
    }
    const askEdit = () =>
      editFormGuard.current ? editFormGuard.current(edit) : edit()
    if (newFormGuard.current) newFormGuard.current(askEdit)
    else askEdit()
  }, [])

  const handleSaved = useCallback(() => {
    void fetchUpdates()
    onSuccess?.()
  }, [fetchUpdates, onSuccess])

  return (
    <>
      <EntityList
        title='Updates'
        icon={MessageSquareText}
        titleAddon={
          updates.length > 0 ? (
            <Badge variant='secondary'>{updates.length}</Badge>
          ) : null
        }
        add={
          canManage ? { label: 'Add update', onAdd: openLogDialog } : undefined
        }
        inlineForm={
          <LeadUpdateDialog
            leadId={lead.id}
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            update={null}
            onSaved={handleSaved}
            closeRequest={closeRequest}
            guardRef={newFormGuard}
          />
        }
        inlineFormOpen={isDialogOpen}
        onInlineFormClose={() => setCloseRequest(n => n + 1)}
        isEmpty={updates.length === 0}
        emptyMessage='No updates on this lead yet.'
        status={
          isLoading ? (
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
          ) : undefined
        }
      >
        {updates.map(update =>
          editingUpdate?.id === update.id ? (
            <LeadUpdateDialog
              key={update.id}
              leadId={lead.id}
              open
              onOpenChange={open => {
                if (!open) setEditingUpdate(null)
              }}
              update={update}
              onSaved={() => {
                setEditingUpdate(null)
                handleSaved()
              }}
              guardRef={editFormGuard}
            />
          ) : (
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
          )
        )}
      </EntityList>
    </>
  )
}
