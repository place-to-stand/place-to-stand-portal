'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { useToast } from '@/components/ui/use-toast'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'

import type {
  ClientRow,
  InvoiceWithClient,
  ProductCatalogItemRow,
} from '@/lib/invoices/invoice-form'
import type { TaxRateData } from '@/lib/invoices/use-invoice-sheet-state'
import { isInvoiceStatus } from '@/lib/invoices/filters'
import {
  archiveInvoice,
  restoreInvoice,
  destroyInvoice,
} from '../actions'
import { sendInvoiceAction } from '../actions/send-invoice'

import { InvoiceArchiveDialog } from './invoice-archive-dialog'
import { InvoicesTableSection } from './invoices-table-section'
import { InvoiceSheet } from '../invoice-sheet'

type InvoicesManagementTableProps = {
  invoices: InvoiceWithClient[]
  clients: ClientRow[]
  productCatalog: ProductCatalogItemRow[]
  taxRates: TaxRateData[]
  totalCount: number
  currentPage: number
  totalPages: number
  pageSize: number
  mode: 'active' | 'archive'
  /** Route the list params live on — '/invoices' or '/invoices/archive'. */
  basePath: string
  /**
   * Invoice resolved server-side from the `?invoice=` share link. May not be
   * in `invoices` when it sits on another page or is filtered out.
   */
  deepLinkedInvoice?: InvoiceWithClient | null
  /** True when `?invoice=` points at an invoice that no longer exists. */
  invoiceNotFound?: boolean
}

const EMPTY_MESSAGES = {
  active:
    'No invoices created yet. Create a new invoice to start billing clients.',
  archive:
    'Archive is empty. Archived invoices appear here after deletion.',
} as const

const PENDING_REASON = 'Please wait for the current request to finish.'

export function InvoicesManagementTable({
  invoices,
  clients,
  productCatalog,
  taxRates,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  mode,
  basePath,
  deepLinkedInvoice,
  invoiceNotFound = false,
}: InvoicesManagementTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // `?invoice=` drives the sheet so an open invoice is a shareable link.
  const { selectedId, isCreating, select, clear } =
    useSheetParamSelection('invoice')
  const [deleteTarget, setDeleteTarget] = useState<InvoiceWithClient | null>(
    null
  )
  const [destroyTarget, setDestroyTarget] = useState<InvoiceWithClient | null>(
    null
  )
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [clients]
  )

  // Run raw params through the type guard (R4): an invalid ?status= is
  // ignored by the server, so it must not count as an active filter.
  const hasActiveFilter =
    isInvoiceStatus(searchParams.get('status') ?? undefined) ||
    Boolean(searchParams.get('q')?.trim())

  const emptyMessage = hasActiveFilter
    ? 'No invoices match the current filters.'
    : EMPTY_MESSAGES[mode]

  // -------------------------------------------------------------------------
  // Sheet handlers
  // -------------------------------------------------------------------------

  // Resolve the record from the page's fresh props so router.refresh() (e.g.
  // after send/unsend/void) re-renders the open sheet with the latest row;
  // the deep-linked copy covers invoices on another page or behind a filter.
  const selectedInvoice = selectedId
    ? (invoices.find(inv => inv.id === selectedId) ??
      (deepLinkedInvoice?.id === selectedId ? deepLinkedInvoice : null))
    : null

  // Keep the last-opened invoice rendered while the sheet animates closed.
  const [lastOpenedInvoice, setLastOpenedInvoice] =
    useState<InvoiceWithClient | null>(null)
  if (isCreating) {
    if (lastOpenedInvoice !== null) {
      setLastOpenedInvoice(null)
    }
  } else if (selectedInvoice && selectedInvoice !== lastOpenedInvoice) {
    setLastOpenedInvoice(selectedInvoice)
  }

  const sheetOpen = isCreating || Boolean(selectedInvoice)
  const sheetInvoice = isCreating
    ? null
    : (selectedInvoice ?? lastOpenedInvoice)

  const openEdit = (invoice: InvoiceWithClient) => {
    select(invoice.id)
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

  // Drop a `?invoice=` pointing at a row the action just removed so the
  // refresh doesn't resolve it into a not-found notice.
  const clearIfSelected = useCallback(
    (invoiceId: string) => {
      if (selectedId === invoiceId) {
        clear()
      }
    },
    [clear, selectedId]
  )

  // -------------------------------------------------------------------------
  // Archive handlers
  // -------------------------------------------------------------------------

  const handleRequestDelete = (invoice: InvoiceWithClient) => {
    if (invoice.deleted_at || isPending) return
    setDeleteTarget(invoice)
  }

  const handleCancelDelete = () => {
    if (isPending) return
    setDeleteTarget(null)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget || deleteTarget.deleted_at) {
      setDeleteTarget(null)
      return
    }

    const invoice = deleteTarget
    setDeleteTarget(null)
    setPendingDeleteId(invoice.id)

    startTransition(async () => {
      try {
        const result = await archiveInvoice({ id: invoice.id })

        if (result.error) {
          toast({
            title: 'Unable to archive invoice',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Invoice archived',
          description:
            'The invoice is hidden from active views but remains in history.',
        })
        clearIfSelected(invoice.id)
        router.refresh()
      } finally {
        setPendingDeleteId(null)
      }
    })
  }

  // -------------------------------------------------------------------------
  // Restore handlers
  // -------------------------------------------------------------------------

  const handleRestore = (invoice: InvoiceWithClient) => {
    if (!invoice.deleted_at || isPending) return

    setPendingRestoreId(invoice.id)

    startTransition(async () => {
      try {
        const result = await restoreInvoice({ id: invoice.id })

        if (result.error) {
          toast({
            title: 'Unable to restore invoice',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Invoice restored',
          description: 'The invoice is active again.',
        })
        clearIfSelected(invoice.id)
        router.refresh()
      } finally {
        setPendingRestoreId(null)
      }
    })
  }

  // -------------------------------------------------------------------------
  // Destroy handlers
  // -------------------------------------------------------------------------

  const handleRequestDestroy = (invoice: InvoiceWithClient) => {
    if (!invoice.deleted_at || isPending) return
    setDestroyTarget(invoice)
  }

  const handleCancelDestroy = () => {
    if (isPending) return
    setDestroyTarget(null)
  }

  const handleConfirmDestroy = () => {
    if (!destroyTarget || !destroyTarget.deleted_at) {
      setDestroyTarget(null)
      return
    }

    const invoice = destroyTarget
    setDestroyTarget(null)
    setPendingDestroyId(invoice.id)

    startTransition(async () => {
      try {
        const result = await destroyInvoice({ id: invoice.id })

        if (result.error) {
          toast({
            title: 'Unable to permanently delete invoice',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Invoice permanently deleted',
          description: 'The invoice has been removed.',
        })
        router.refresh()
      } finally {
        setPendingDestroyId(null)
      }
    })
  }

  // -------------------------------------------------------------------------
  // Send invoice (from table share link generation)
  // -------------------------------------------------------------------------

  const handleSendInvoice = useCallback(
    (invoiceId: string) => {
      startTransition(async () => {
        const result = await sendInvoiceAction({ id: invoiceId })
        if (result.error) {
          toast({
            title: 'Unable to send invoice',
            description: result.error,
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Invoice marked as sent',
            description: result.invoiceNumber
              ? `${result.invoiceNumber} is now active.`
              : 'The invoice is now active.',
          })
          router.refresh()
        }
      })
    },
    [router, startTransition, toast]
  )

  const handleRefresh = useCallback(() => {
    router.refresh()
  }, [router])

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (page <= 1) {
        params.delete('page')
      } else {
        params.set('page', String(page))
      }
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    },
    [pathname, router, searchParams]
  )

  return (
    <div className='space-y-4'>
      {invoiceNotFound ? (
        <div
          role='status'
          className='border-destructive/30 bg-destructive/5 flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm'
        >
          <span>
            The linked invoice could not be found. It may have been
            permanently deleted.
          </span>
          <Button variant='ghost' size='sm' onClick={clear}>
            Dismiss
          </Button>
        </div>
      ) : null}
      <InvoiceArchiveDialog
        open={Boolean(deleteTarget)}
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Permanently delete invoice?'
        description='This action removes the invoice forever. Make sure no other records depend on it.'
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDestroy}
        onConfirm={handleConfirmDestroy}
      />
      <InvoicesTableSection
        invoices={invoices}
        mode={mode}
        onEdit={openEdit}
        onRequestDelete={handleRequestDelete}
        onRestore={handleRestore}
        onRequestDestroy={handleRequestDestroy}
        onSendInvoice={handleSendInvoice}
        onRefresh={handleRefresh}
        isPending={isPending}
        pendingReason={PENDING_REASON}
        pendingDeleteId={pendingDeleteId}
        pendingRestoreId={pendingRestoreId}
        pendingDestroyId={pendingDestroyId}
        emptyMessage={emptyMessage}
        basePath={basePath}
      />
      <PaginationControls
        mode='paged'
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={handlePageChange}
      />
      <InvoiceSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleComplete}
        invoice={sheetInvoice}
        clients={sortedClients}
        productCatalog={productCatalog}
        taxRates={taxRates}
      />
    </div>
  )
}
