'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'

import type { ClientRow } from './client-sheet-utils'

type UseClientSheetSelectionArgs = {
  /**
   * Rows rendered by the host page. The open sheet re-resolves from these on
   * every render, so a `router.refresh()` re-renders it with the server's
   * latest row instead of a stale snapshot.
   */
  clients?: ClientRow[]
  /**
   * Row resolved server-side from `?client=<id>`. Used when the list can't
   * supply it — filters/pagination hide it, or the view renders no rows.
   */
  deepLinkedClient?: ClientRow | null
}

/**
 * `?client=` drives which client sheet is open, so an open sheet is always a
 * shareable link. Shared by the clients landing and the archive table — the
 * URL is the shared state, so hosts don't prop-drill selection to each other.
 */
export function useClientSheetSelection({
  clients,
  deepLinkedClient = null,
}: UseClientSheetSelectionArgs = {}) {
  const router = useRouter()
  const { selectedId, isCreating, select, openCreate, clear } =
    useSheetParamSelection('client')

  const selectedClient: ClientRow | null = selectedId
    ? (clients?.find(client => client.id === selectedId) ??
      (deepLinkedClient?.id === selectedId ? deepLinkedClient : null))
    : null

  // `?client=new` opens the create sheet; an id that resolves to nothing (a
  // deleted row) keeps the sheet closed — the page shows the notice instead.
  const resolvedClient = isCreating ? null : selectedClient
  const sheetOpen = isCreating || selectedClient !== null

  // Keep the last-rendered record mounted after close so the sheet's exit
  // animation can play; only `open` toggles.
  const [lastClient, setLastClient] = useState<ClientRow | null>(null)
  if (sheetOpen && resolvedClient !== lastClient) {
    setLastClient(resolvedClient)
  }

  const openEdit = (client: ClientRow) => {
    select(client.id)
  }

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) {
      clear()
    }
  }

  const handleSheetComplete = () => {
    clear()
    router.refresh()
  }

  return {
    selectedId,
    sheetOpen,
    sheetClient: sheetOpen ? resolvedClient : lastClient,
    openCreate,
    openEdit,
    clear,
    handleSheetOpenChange,
    handleSheetComplete,
  }
}
