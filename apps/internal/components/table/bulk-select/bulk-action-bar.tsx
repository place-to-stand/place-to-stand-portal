'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Archive, CheckCheck, Loader2, RefreshCw, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { RowActionButton } from '@pts/ui/row-action-button'
import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  BULK_ARCHIVE_ENTITIES,
  countLabel,
  type BulkArchiveEntity,
  type BulkSelectionInput,
} from '@/lib/bulk/archive-entities'
import { bulkSetArchived } from '@/app/(dashboard)/_actions/bulk-archive'

import type { RowSelection } from './use-row-selection'
import { describeBulkResult } from './bulk-result-toast'

/** URL params that open sheets or page the list, not filters. */
const NON_FILTER_PARAMS = new Set(['page'])

type BulkActionBarProps = {
  selection: RowSelection
  entity: BulkArchiveEntity
  /** The active list archives; its Archive tab restores. */
  mode: 'active' | 'archive'
  /** Extra sentence for the archive confirmation (a list's consequences). */
  archiveExtra?: string
  /** A row's name, for naming refused rows in the result toast. */
  nameOf?: (id: string) => string | undefined
  /** Runs after a bulk change lands (defaults to a router refresh). */
  onDone?: () => void
  /** Stands in for the server action (the /design demo). */
  runAction?: typeof bulkSetArchived
}

/**
 * The bar that appears once rows are ticked: how many, "Select all N" when
 * the whole page is ticked and more rows match, and the bulk actions.
 * Each row runs through its list's own archive or restore, so the same
 * rules apply as the row buttons; refused rows are named in the toast.
 */
export function BulkActionBar({
  selection,
  entity,
  mode,
  archiveExtra,
  nameOf,
  onDone,
  runAction = bulkSetArchived,
}: BulkActionBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()
  const words = BULK_ARCHIVE_ENTITIES[entity]
  const archive = mode === 'active'

  if (!selection.active) return null

  const selected = countLabel(entity, selection.count)

  const run = () => {
    const input: BulkSelectionInput = selection.allMatching
      ? {
          kind: 'matching',
          params: Object.fromEntries(
            [...searchParams.entries()].filter(
              ([key]) => !NON_FILTER_PARAMS.has(key)
            )
          ),
        }
      : { kind: 'ids', ids: [...selection.ids] }

    startTransition(async () => {
      const result = await runAction({
        entity,
        archive,
        selection: input,
      })
      setConfirming(false)
      for (const message of describeBulkResult({
        result,
        entity,
        archive,
        nameOf,
      })) {
        toast(message)
      }
      if (result.done > 0) {
        selection.clear()
        if (onDone) onDone()
        else router.refresh()
      }
    })
  }

  return (
    <>
      <div className='pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4'>
        <div
          role='toolbar'
          aria-label={`Bulk actions for ${words.plural}`}
          className='bg-popover text-popover-foreground pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border py-2 pr-2 pl-4 text-sm shadow-lg'
        >
          <span className='font-medium tabular-nums' aria-live='polite'>
            {selection.allMatching
              ? `All ${selected} selected`
              : `${selected} selected`}
          </span>
          {selection.canSelectAllMatching ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={selection.selectAllMatching}
            >
              <CheckCheck />
              Select all {countLabel(entity, selection.matchingCount)}
            </Button>
          ) : null}
          <div className='flex items-center gap-2'>
            {archive ? (
              <Button
                type='button'
                variant='destructive'
                size='sm'
                disabled={isPending}
                onClick={() => setConfirming(true)}
              >
                <Archive />
                Archive
              </Button>
            ) : (
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={isPending}
                onClick={run}
              >
                {isPending ? (
                  <Loader2 className='animate-spin' />
                ) : (
                  <RefreshCw />
                )}
                {isPending ? 'Restoring…' : 'Restore'}
              </Button>
            )}
            <RowActionButton
              type='button'
              label='Clear selection'
              icon={<X />}
              disabled={isPending}
              onClick={selection.clear}
            />
          </div>
        </div>
      </div>
      <ArchiveConfirmDialog
        open={confirming}
        many={selection.count !== 1}
        entity={selection.count === 1 ? words.singular : selected}
        name={
          selection.count === 1
            ? `this ${words.singular}`
            : selection.allMatching
              ? `all ${selected} matching your filters`
              : `these ${selected}`
        }
        list={words.list}
        extra={archiveExtra}
        pending={isPending}
        onCancel={() => {
          if (!isPending) setConfirming(false)
        }}
        onConfirm={run}
      />
    </>
  )
}
