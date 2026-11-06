'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Archive, CheckCheck, Loader2, RefreshCw, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { RowActionButton } from '@pts/ui/row-action-button'
import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  BULK_ARCHIVE_ENTITIES,
  countLabel,
  type BulkActionResult,
  type BulkArchiveEntity,
  type BulkSelectionInput,
} from '@/lib/bulk/archive-entities'
import {
  bulkSetArchived,
  resolveBulkMatchingIds,
} from '@/app/(dashboard)/_actions/bulk-archive'

import type { RowSelection } from './use-row-selection'
import { describeBulkResult, type BulkVerb } from './bulk-result-toast'
import { CHUNK_FAILED, runInChunks } from '@/lib/bulk/run-in-chunks'

/** URL params that open sheets or page the list, not filters. */
const NON_FILTER_PARAMS = new Set(['page'])

/**
 * A list's own bulk action beside Archive (Submissions: Mark acknowledged).
 * It runs over the same selection and reports through the same toasts.
 */
export type BulkBarAction = BulkVerb & {
  label: string
  pendingLabel: string
  icon: ReactNode
  run: (selection: BulkSelectionInput) => Promise<BulkActionResult>
}

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
  /** The list's own actions, shown before Archive or Restore. */
  actions?: BulkBarAction[]
  /** Stands in for the server actions (the /design demo). */
  runAction?: typeof bulkSetArchived
  resolveMatching?: typeof resolveBulkMatchingIds
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
  actions = [],
  runAction = bulkSetArchived,
  resolveMatching = resolveBulkMatchingIds,
}: BulkActionBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [pendingLabel, setPendingLabel] = useState<string | null>(null)
  const words = BULK_ARCHIVE_ENTITIES[entity]
  const archive = mode === 'active'

  if (!selection.active) return null

  const selected = countLabel(entity, selection.count)

  const runWith = (
    verb: BulkVerb,
    label: string,
    action: (input: BulkSelectionInput) => Promise<BulkActionResult>
  ) => {
    const params = Object.fromEntries(
      [...searchParams.entries()].filter(([key]) => !NON_FILTER_PARAMS.has(key))
    )
    const allMatching = selection.allMatching
    const pageIds = [...selection.ids]

    setPendingLabel(label)
    startTransition(async () => {
      let result: BulkActionResult
      try {
        const resolved = allMatching
          ? await resolveMatching({
              entity,
              params,
              archived: mode === 'archive',
            })
          : { ids: pageIds }
        result =
          'error' in resolved
            ? { done: 0, failed: [], warnings: [], error: resolved.error }
            : await runInChunks(resolved.ids, action)
      } catch {
        result = { done: 0, failed: [], warnings: [], error: CHUNK_FAILED }
      }
      setConfirming(false)
      setPendingLabel(null)
      for (const message of describeBulkResult({
        result,
        entity,
        verb,
        nameOf,
      })) {
        toast(message)
      }
      // Rows done before a failure changed too, so the list refreshes.
      if (result.done > 0 || result.error === CHUNK_FAILED) {
        selection.clear()
        if (onDone) onDone()
        else router.refresh()
      }
    })
  }

  const run = () =>
    runWith(
      archive
        ? { verb: 'archive', past: 'archived' }
        : { verb: 'restore', past: 'restored' },
      archive ? 'archive' : 'restore',
      input => runAction({ entity, archive, selection: input })
    )

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
            {actions.map(action => (
              <Button
                key={action.label}
                type='button'
                variant='outline'
                size='sm'
                disabled={isPending}
                onClick={() => runWith(action, action.label, action.run)}
              >
                {pendingLabel === action.label ? (
                  <Loader2 className='animate-spin' />
                ) : (
                  action.icon
                )}
                {pendingLabel === action.label
                  ? action.pendingLabel
                  : action.label}
              </Button>
            ))}
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
                {pendingLabel === 'restore' ? (
                  <Loader2 className='animate-spin' />
                ) : (
                  <RefreshCw />
                )}
                {pendingLabel === 'restore' ? 'Restoring…' : 'Restore'}
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
