'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, ExternalLink, Send, XCircle, RefreshCw } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { InvoiceWithRelations } from '@/lib/invoices/types'
import { isTerminal } from '@/lib/invoices/constants'

import { sendInvoiceAction } from '../_actions/send-invoice'
import { voidInvoiceAction } from '../_actions/void-invoice'
import { duplicateInvoiceAction } from '../_actions/duplicate-invoice'
import { deleteInvoiceAction } from '../_actions/delete-invoice'
import { checkPaymentStatusAction } from '../_actions/check-payment-status'
import { InvoiceStatusBadge } from './invoice-status-badge'
import { LineItemEditor, type LineItemFormData } from './line-item-editor'

type InvoiceDetailSheetProps = {
  invoice: InvoiceWithRelations | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InvoiceDetailSheet({
  invoice,
  open,
  onOpenChange,
}: InvoiceDetailSheetProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  if (!invoice) return null

  const canSend = invoice.status === 'DRAFT'
  const canVoid = !isTerminal(invoice.status)
  const canDelete = invoice.status === 'DRAFT'
  const canCheckPayment = (invoice.status === 'SENT' || invoice.status === 'VIEWED') && invoice.stripePaymentIntentId
  const shareUrl = invoice.shareToken && invoice.shareEnabled
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invoice/${invoice.shareToken}`
    : null

  const lineItems: LineItemFormData[] = invoice.lineItems.map(li => ({
    type: li.type,
    description: li.description,
    quantity: li.quantity,
    unitPrice: li.unitPrice,
    amount: li.amount,
  }))

  const handleAction = (
    action: () => Promise<{ success: boolean; error?: string }>
  ) => {
    setFeedback(null)
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        router.refresh()
        onOpenChange(false)
      } else {
        setFeedback(result.error ?? 'Something went wrong.')
      }
    })
  }

  const handleCopyLink = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl)
      setFeedback('Link copied!')
      setTimeout(() => setFeedback(null), 2000)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle className='flex items-center gap-3'>
            <span>
              {invoice.invoiceNumber ?? 'Draft Invoice'}
            </span>
            <InvoiceStatusBadge status={invoice.status} dueDate={invoice.dueDate} />
          </SheetTitle>
        </SheetHeader>

        <div className='mt-6 space-y-6'>
          {/* Details */}
          <div className='grid gap-3 text-sm'>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Client</span>
              <span className='font-medium'>{invoice.client.name}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Total</span>
              <span className='font-semibold tabular-nums'>
                ${Number(invoice.total).toFixed(2)}
              </span>
            </div>
            {invoice.dueDate && (
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Due Date</span>
                <span>{new Date(invoice.dueDate).toLocaleDateString()}</span>
              </div>
            )}
            {invoice.issuedAt && (
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Issued</span>
                <span>{new Date(invoice.issuedAt).toLocaleDateString()}</span>
              </div>
            )}
            {invoice.paidAt && (
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Paid</span>
                <span>{new Date(invoice.paidAt).toLocaleDateString()}</span>
              </div>
            )}
            {invoice.viewedCount ? (
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Views</span>
                <span>{invoice.viewedCount}</span>
              </div>
            ) : null}
          </div>

          <Separator />

          {/* Line items */}
          <div className='space-y-2'>
            <h3 className='text-sm font-medium'>Line Items</h3>
            <LineItemEditor items={lineItems} onChange={() => {}} readOnly />
          </div>

          {invoice.notes && (
            <>
              <Separator />
              <div className='space-y-1'>
                <h3 className='text-sm font-medium'>Notes</h3>
                <p className='text-sm text-muted-foreground whitespace-pre-wrap'>
                  {invoice.notes}
                </p>
              </div>
            </>
          )}

          {shareUrl && (
            <>
              <Separator />
              <div className='space-y-2'>
                <h3 className='text-sm font-medium'>Share Link</h3>
                <div className='flex gap-2'>
                  <code className='flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs'>
                    {shareUrl}
                  </code>
                  <Button variant='outline' size='icon' className='shrink-0' onClick={handleCopyLink}>
                    <Copy className='h-4 w-4' />
                  </Button>
                  <Button variant='outline' size='icon' className='shrink-0' asChild>
                    <a href={shareUrl} target='_blank' rel='noopener noreferrer'>
                      <ExternalLink className='h-4 w-4' />
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}

          {feedback && (
            <p className={`text-sm ${feedback.includes('copied') ? 'text-green-600' : 'text-destructive'}`}>
              {feedback}
            </p>
          )}

          <Separator />

          {/* Actions */}
          <div className='flex flex-wrap gap-2'>
            {canSend && (
              <Button
                onClick={() => handleAction(() => sendInvoiceAction(invoice.id))}
                disabled={isPending}
              >
                <Send className='mr-1.5 h-4 w-4' />
                Send Invoice
              </Button>
            )}
            {canCheckPayment && (
              <Button
                variant='outline'
                onClick={() => handleAction(() => checkPaymentStatusAction(invoice.id))}
                disabled={isPending}
              >
                <RefreshCw className='mr-1.5 h-4 w-4' />
                Check Payment
              </Button>
            )}
            <Button
              variant='outline'
              onClick={() => handleAction(() => duplicateInvoiceAction(invoice.id))}
              disabled={isPending}
            >
              <Copy className='mr-1.5 h-4 w-4' />
              Duplicate
            </Button>
            {canVoid && (
              <Button
                variant='outline'
                className='text-destructive'
                onClick={() => handleAction(() => voidInvoiceAction(invoice.id))}
                disabled={isPending}
              >
                <XCircle className='mr-1.5 h-4 w-4' />
                Void
              </Button>
            )}
            {canDelete && (
              <Button
                variant='destructive'
                onClick={() => handleAction(() => deleteInvoiceAction(invoice.id))}
                disabled={isPending}
              >
                Delete Draft
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
