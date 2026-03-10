'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { useToast } from '@/components/ui/use-toast'

import type {
  ClientRow,
  InvoiceWithClient,
  ProductCatalogItemRow,
} from '@/lib/invoices/invoice-form'
import {
  archiveInvoice,
  restoreInvoice,
  destroyInvoice,
  sendInvoiceAction,
  voidInvoice,
} from '../actions'

import { InvoiceArchiveDialog } from './invoice-archive-dialog'
import { InvoicesTableSection } from './invoices-table-section'
import { ShareInvoiceDialog } from './share-invoice-dialog'
import { InvoiceSheet } from '../invoice-sheet'

type InvoicesManagementTableProps = {
  invoices: InvoiceWithClient[]
  clients: ClientRow[]
  productCatalog: ProductCatalogItemRow[]
  totalCount: number
  currentPage: number
  totalPages: number
  pageSize: number
  mode: 'active' | 'archive'
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
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  mode,
}: InvoicesManagementTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] =
    useState<InvoiceWithClient | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InvoiceWithClient | null>(
    null
  )
  const [destroyTarget, setDestroyTarget] = useState<InvoiceWithClient | null>(
    null
  )
  const [voidTarget, setVoidTarget] = useState<InvoiceWithClient | null>(null)
  const [shareTarget, setShareTarget] = useState<InvoiceWithClient | null>(null)

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [pendingSendId, setPendingSendId] = useState<string | null>(null)
  const [pendingVoidId, setPendingVoidId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [clients]
  )

  const emptyMessage = EMPTY_MESSAGES[mode]

  // Check for proposal-to-invoice pre-fill on mount
  const prefillCheckedRef = useRef(false)
  useEffect(() => {
    if (prefillCheckedRef.current || mode !== 'active') return
    prefillCheckedRef.current = true

    const from = searchParams.get('from')
    if (from !== 'proposal') return

    const raw = sessionStorage.getItem('invoice-prefill')
    if (!raw) return

    sessionStorage.removeItem('invoice-prefill')
    // Clean URL
    const params = new URLSearchParams(searchParams.toString())
    params.delete('from')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)

    // Open sheet in create mode (pre-fill will be handled by the sheet via sessionStorage)
    // Re-set for the sheet to read
    sessionStorage.setItem('invoice-prefill', raw)
    setSelectedInvoice(null)
    setSheetOpen(true)
  }, [mode, pathname, router, searchParams])

  // -------------------------------------------------------------------------
  // Sheet handlers
  // -------------------------------------------------------------------------

  const openEdit = (invoice: InvoiceWithClient) => {
    setSelectedInvoice(invoice)
    setSheetOpen(true)
  }

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) {
      setSelectedInvoice(null)
    }
  }

  const handleComplete = () => {
    setSheetOpen(false)
    setSelectedInvoice(null)
    router.refresh()
  }

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
  // Send handler
  // -------------------------------------------------------------------------

  const handleSend = (invoice: InvoiceWithClient) => {
    if (invoice.status !== 'DRAFT' || isPending) return

    setPendingSendId(invoice.id)

    startTransition(async () => {
      try {
        const result = await sendInvoiceAction({ id: invoice.id })

        if (result.error) {
          toast({
            title: 'Unable to send invoice',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Invoice sent',
          description: result.invoiceNumber
            ? `Invoice ${result.invoiceNumber} has been issued and sharing is enabled.`
            : 'Invoice has been issued and sharing is enabled.',
        })
        router.refresh()
      } finally {
        setPendingSendId(null)
      }
    })
  }

  // -------------------------------------------------------------------------
  // Copy link handler
  // -------------------------------------------------------------------------

  const handleCopyLink = (invoice: InvoiceWithClient) => {
    if (!invoice.share_enabled || !invoice.share_token) return

    const shareUrl = `${window.location.origin}/share/invoices/${invoice.share_token}`
    navigator.clipboard.writeText(shareUrl)
    toast({
      title: 'Link copied',
      description: 'Invoice share link copied to clipboard.',
    })
  }

  // -------------------------------------------------------------------------
  // Void handlers
  // -------------------------------------------------------------------------

  const handleRequestVoid = (invoice: InvoiceWithClient) => {
    if (isPending) return
    setVoidTarget(invoice)
  }

  const handleCancelVoid = () => {
    if (isPending) return
    setVoidTarget(null)
  }

  const handleConfirmVoid = () => {
    if (!voidTarget) {
      setVoidTarget(null)
      return
    }

    const invoice = voidTarget
    setVoidTarget(null)
    setPendingVoidId(invoice.id)

    startTransition(async () => {
      try {
        const result = await voidInvoice({ id: invoice.id })

        if (result.error) {
          toast({
            title: 'Unable to void invoice',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: 'Invoice voided',
          description: 'The invoice has been marked as void.',
        })
        router.refresh()
      } finally {
        setPendingVoidId(null)
      }
    })
  }

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
    <div className='space-y-6'>
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
      <ConfirmDialog
        open={Boolean(voidTarget)}
        title='Void invoice?'
        description='Voiding this invoice marks it as canceled. This cannot be undone.'
        confirmLabel='Void invoice'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelVoid}
        onConfirm={handleConfirmVoid}
      />
      {shareTarget ? (
        <ShareInvoiceDialog
          open={Boolean(shareTarget)}
          onOpenChange={open => {
            if (!open) setShareTarget(null)
          }}
          invoiceId={shareTarget.id}
          invoiceNumber={shareTarget.invoice_number}
          shareToken={shareTarget.share_token}
          shareEnabled={shareTarget.share_enabled}
          viewedCount={shareTarget.viewed_count}
          onUpdate={() => router.refresh()}
        />
      ) : null}
      <InvoicesTableSection
        invoices={invoices}
        mode={mode}
        onEdit={openEdit}
        onRequestDelete={handleRequestDelete}
        onRestore={handleRestore}
        onRequestDestroy={handleRequestDestroy}
        onSend={handleSend}
        onCopyLink={handleCopyLink}
        onVoid={handleRequestVoid}
        isPending={isPending}
        pendingReason={PENDING_REASON}
        pendingDeleteId={pendingDeleteId}
        pendingRestoreId={pendingRestoreId}
        pendingDestroyId={pendingDestroyId}
        pendingSendId={pendingSendId}
        pendingVoidId={pendingVoidId}
        emptyMessage={emptyMessage}
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
        invoice={selectedInvoice}
        clients={sortedClients}
        productCatalog={productCatalog}
      />
    </div>
  )
}
