'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, CheckCheck, Mail, Undo2 } from 'lucide-react'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'

import { toastLink, useToast } from '@/components/ui/use-toast'
import { invoiceShareHref } from '@/lib/invoices/links'

import { InvoiceEmailDialog } from '../_components/invoice-email-dialog'
import { InvoiceVoidDialog } from '../_components/invoice-void-dialog'
import { sendInvoiceAction, unsendInvoice, voidInvoice } from '../actions'

/** An invoice's status actions, the same in its sheet and on its list row. */
export type InvoiceStatusAction = 'email' | 'send' | 'unsend' | 'void'

const VOIDABLE_STATUSES = new Set(['DRAFT', 'SENT', 'VIEWED'])
const RESENDABLE_STATUSES = new Set(['SENT', 'VIEWED'])

/** Which status actions an invoice in `status` offers, in display order. */
export function invoiceStatusActions(status: string): InvoiceStatusAction[] {
  const actions: InvoiceStatusAction[] = []
  if (status === 'DRAFT' || RESENDABLE_STATUSES.has(status)) {
    actions.push('email')
  }
  if (status === 'DRAFT') actions.push('send')
  if (status === 'SENT') actions.push('unsend')
  if (VOIDABLE_STATUSES.has(status)) actions.push('void')
  return actions
}

/** The button label for each action ("Send to client" on a draft). */
export function invoiceStatusActionLabel(
  action: InvoiceStatusAction,
  status: string
): string {
  switch (action) {
    case 'email':
      return status === 'DRAFT' ? 'Send to client' : 'Email again'
    case 'send':
      return 'Mark as sent'
    case 'unsend':
      return 'Revert to draft'
    case 'void':
      return 'Void invoice'
  }
}

/** Each action's icon, tinted by what it does: the sheet and the rows match. */
export const INVOICE_ACTION_ICONS: Record<InvoiceStatusAction, ReactNode> = {
  email: <Mail className='text-success' />,
  send: <CheckCheck className='text-success' />,
  unsend: <Undo2 className='text-warning' />,
  void: <Ban className='text-destructive' />,
}

type Confirming = { action: 'send' | 'unsend' | 'void'; id: string }

/**
 * Runs an invoice's status actions: the email dialog, the Mark as sent and
 * Revert to draft confirms, the void dialog, the server actions, the toasts
 * and a refresh. The invoice sheet and the invoices list share it, so a row
 * button does exactly what the sheet's button does.
 */
export function useInvoiceStatusActions({
  linkHint,
}: {
  /** Where to copy the public link when the clipboard write fails. */
  linkHint: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  // Kept after closing, so the dialog can animate out.
  const [emailing, setEmailing] = useState<{
    id: string
    open: boolean
  } | null>(null)
  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const run = useCallback(
    async <R extends { error?: string }>(
      id: string,
      failTitle: string,
      action: () => Promise<R>,
      onSuccess: (result: R) => Promise<void> | void
    ) => {
      setPendingId(id)
      try {
        const result = await action()
        if (result.error) {
          toast({
            title: failTitle,
            description: result.error,
            variant: 'destructive',
            link: toastLink('invoice', id),
          })
          return
        }
        await onSuccess(result)
        router.refresh()
      } catch {
        toast({
          title: failTitle,
          description: 'An unexpected error occurred. Please try again.',
          variant: 'destructive',
          link: toastLink('invoice', id),
        })
      } finally {
        setPendingId(null)
      }
    },
    [router, toast]
  )

  const markSent = useCallback(
    (id: string) =>
      run(
        id,
        'Unable to mark invoice as sent',
        () => sendInvoiceAction({ id }),
        async result => {
          // One click: sent, link live, link on the clipboard to paste into
          // whatever the admin is sending it with.
          const shareToken = result.shareToken
          const copied = shareToken
            ? await navigator.clipboard
                .writeText(
                  `${window.location.origin}${invoiceShareHref(shareToken)}`
                )
                .then(
                  () => true,
                  () => false
                )
            : false
          toast({
            title: 'Invoice marked as sent',
            description: copied
              ? 'The public link is copied to your clipboard.'
              : linkHint,
            link: toastLink('invoice', id),
          })
        }
      ),
    [linkHint, run, toast]
  )

  const revert = useCallback(
    (id: string) =>
      run(
        id,
        'Unable to revert invoice to draft',
        () => unsendInvoice({ id }),
        () => {
          toast({
            title: 'Invoice reverted to draft',
            description: 'The invoice has been reverted to draft.',
            link: toastLink('invoice', id),
          })
        }
      ),
    [run, toast]
  )

  const voidIt = useCallback(
    (id: string) =>
      run(
        id,
        'Unable to void invoice',
        () => voidInvoice({ id }),
        () => {
          toast({
            title: 'Invoice voided',
            description: 'The invoice has been marked as void.',
            link: toastLink('invoice', id),
          })
        }
      ),
    [run, toast]
  )

  /** Starts an action: email opens its dialog, the rest confirm first. */
  const request = useCallback((action: InvoiceStatusAction, id: string) => {
    if (action === 'email') setEmailing({ id, open: true })
    else setConfirming({ action, id })
  }, [])

  const confirm = () => {
    const target = confirming
    setConfirming(null)
    if (!target) return
    if (target.action === 'send') void markSent(target.id)
    if (target.action === 'unsend') void revert(target.id)
    if (target.action === 'void') void voidIt(target.id)
  }

  const statusConfirm =
    confirming && confirming.action !== 'void' ? confirming.action : null

  const dialogs = (
    <>
      {emailing ? (
        <InvoiceEmailDialog
          invoiceId={emailing.id}
          open={emailing.open}
          onOpenChange={open => setEmailing({ ...emailing, open })}
          onSent={({ invoiceNumber, markedSent }) => {
            const id = emailing.id
            setEmailing({ id, open: false })
            toast({
              title: markedSent ? 'Invoice sent' : 'Invoice emailed',
              description: markedSent
                ? `Invoice ${invoiceNumber} was emailed and marked as sent.`
                : `Invoice ${invoiceNumber} was emailed again.`,
              link: toastLink('invoice', id),
            })
            router.refresh()
          }}
        />
      ) : null}
      <ConfirmDialog
        open={statusConfirm !== null}
        title={
          statusConfirm === 'unsend' ? 'Revert to draft?' : 'Mark as sent?'
        }
        description={
          statusConfirm === 'unsend'
            ? 'The invoice goes back to draft and its share link stops working until it is sent again.'
            : 'The invoice is marked sent without emailing it, and its share link goes live. Use this when you delivered it another way.'
        }
        confirmLabel={
          statusConfirm === 'unsend' ? 'Revert to draft' : 'Mark as sent'
        }
        confirmDisabled={pendingId !== null}
        onCancel={() => setConfirming(null)}
        onConfirm={confirm}
      />
      <InvoiceVoidDialog
        open={confirming?.action === 'void'}
        confirmDisabled={pendingId !== null}
        onCancel={() => setConfirming(null)}
        onConfirm={confirm}
      />
    </>
  )

  return { request, pendingId, dialogs }
}
