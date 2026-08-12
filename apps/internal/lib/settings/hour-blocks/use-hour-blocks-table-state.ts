'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/use-toast'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'
import {
  destroyHourBlock,
  restoreHourBlock,
  softDeleteHourBlock,
} from '@/app/(dashboard)/hour-blocks/actions'
import type {
  ClientRow,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'

type UseHourBlocksTableStateArgs = {
  clients: ClientRow[]
  /** The page's fresh rows — the open sheet re-resolves from them by id. */
  hourBlocks?: HourBlockWithClient[]
  /**
   * Row resolved server-side from `?hour-block=`, used when the paginated
   * list doesn't contain it.
   */
  deepLinkedHourBlock?: HourBlockWithClient | null
}

const pendingReason = 'Please wait for the current request to finish.'

export function useHourBlocksTableState({
  clients,
  hourBlocks,
  deepLinkedHourBlock = null,
}: UseHourBlocksTableStateArgs) {
  const router = useRouter()
  // `?hour-block=` drives the sheet so an open block is a shareable link.
  const { selectedId, isCreating, select, openCreate, clear } =
    useSheetParamSelection('hour-block')
  const selectedBlock: HourBlockWithClient | null = selectedId
    ? (hourBlocks?.find(block => block.id === selectedId) ??
      (deepLinkedHourBlock?.id === selectedId ? deepLinkedHourBlock : null))
    : null
  // Keep the last-opened block rendered while the sheet animates closed.
  const [lastOpenedBlock, setLastOpenedBlock] =
    useState<HourBlockWithClient | null>(null)
  if (isCreating) {
    if (lastOpenedBlock !== null) {
      setLastOpenedBlock(null)
    }
  } else if (selectedBlock && selectedBlock !== lastOpenedBlock) {
    setLastOpenedBlock(selectedBlock)
  }
  const sheetOpen = isCreating || Boolean(selectedBlock)
  const sheetBlock = isCreating ? null : (selectedBlock ?? lastOpenedBlock)
  const [deleteTarget, setDeleteTarget] = useState<HourBlockWithClient | null>(
    null
  )
  const [destroyTarget, setDestroyTarget] =
    useState<HourBlockWithClient | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [clients]
  )

  const createDisabled = sortedClients.length === 0
  const createDisabledReason = createDisabled
    ? 'Create a client before logging hour blocks.'
    : null

  const openEdit = (block: HourBlockWithClient) => {
    select(block.id)
  }

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) {
      clear()
    }
  }

  const handleComplete = () => {
    clear()
    router.refresh()
  }

  const handleRequestDelete = (block: HourBlockWithClient) => {
    if (block.deleted_at || isPending) {
      return
    }

    setDeleteTarget(block)
  }

  const handleCancelDelete = () => {
    if (isPending) {
      return
    }

    setDeleteTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget || deleteTarget.deleted_at) {
      setDeleteTarget(null)
      return
    }

    const block = deleteTarget
    setDeleteTarget(null)
    setPendingDeleteId(block.id)

    startTransition(async () => {
      try {
        const result = await softDeleteHourBlock({ id: block.id })

        if (result.error) {
          toast({
            title: 'Unable to delete hour block',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Hour block archived',
          description:
            'The hour block is hidden from active tracking but remains in history.',
        })
        if (result.warning) {
          toast({ title: 'Heads up', description: result.warning })
        }
        router.refresh()
      } finally {
        setPendingDeleteId(null)
      }
    })
  }

  const handleRestore = (block: HourBlockWithClient) => {
    if (!block.deleted_at || isPending) {
      return
    }

    setPendingRestoreId(block.id)

    startTransition(async () => {
      try {
        const result = await restoreHourBlock({ id: block.id })

        if (result.error) {
          toast({
            title: 'Unable to restore hour block',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Hour block restored',
          description: 'The hour block is active again.',
        })
        if (result.warning) {
          toast({ title: 'Heads up', description: result.warning })
        }
        router.refresh()
      } finally {
        setPendingRestoreId(null)
      }
    })
  }

  const handleRequestDestroy = (block: HourBlockWithClient) => {
    if (!block.deleted_at || isPending) {
      return
    }

    setDestroyTarget(block)
  }

  const handleCancelDestroy = () => {
    if (isPending) {
      return
    }

    setDestroyTarget(null)
  }

  const handleConfirmDestroy = () => {
    if (!destroyTarget || !destroyTarget.deleted_at) {
      setDestroyTarget(null)
      return
    }

    const block = destroyTarget
    setDestroyTarget(null)
    setPendingDestroyId(block.id)

    startTransition(async () => {
      try {
        const result = await destroyHourBlock({ id: block.id })

        if (result.error) {
          toast({
            title: 'Unable to permanently delete hour block',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Hour block permanently deleted',
          description: 'The hour block has been removed.',
        })
        router.refresh()
      } finally {
        setPendingDestroyId(null)
      }
    })
  }

  return {
    sheetOpen,
    // The sheet renders `sheetBlock` (retained through the close animation);
    // `selectedBlock` is the live selection for callers that need it.
    selectedBlock: sheetBlock,
    sortedClients,
    createDisabled,
    createDisabledReason,
    pendingReason,
    openCreate,
    openEdit,
    handleSheetOpenChange,
    handleComplete,
    deleteDialog: {
      open: Boolean(deleteTarget),
      target: deleteTarget,
      onCancel: handleCancelDelete,
      onConfirm: handleConfirmDelete,
    },
    destroyDialog: {
      open: Boolean(destroyTarget),
      target: destroyTarget,
      onCancel: handleCancelDestroy,
      onConfirm: handleConfirmDestroy,
    },
    isPending,
    pendingDeleteId,
    pendingRestoreId,
    pendingDestroyId,
    handleRequestDelete,
    handleRestore,
    handleRequestDestroy,
    /** Drop `?hour-block=` (e.g. after the open row is destroyed). */
    clearSelection: clear,
  }
}
