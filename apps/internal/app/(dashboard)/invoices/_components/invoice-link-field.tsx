'use client'

import { useCallback, useState } from 'react'
import { Check, Copy, ExternalLink, SquareArrowOutUpRight } from 'lucide-react'

import { Input } from '@pts/ui/input'
import { Label } from '@pts/ui/label'
import { RowActionButton } from '@pts/ui/row-action-button'
import { invoicePreviewHref, invoiceShareHref } from '@/lib/invoices/links'

/**
 * The client's link, read-only. There is nothing to turn on or off here:
 * sending makes it live and reverting to draft takes it down. A draft
 * (`shareToken` null) keeps the field's footprint with a placeholder, so the
 * panel doesn't jump when the invoice is sent, and its open button previews
 * the page as the client will see it instead.
 */
export function InvoiceLinkField({
  invoiceId,
  shareToken,
}: {
  invoiceId: string
  shareToken: string | null
}) {
  const [copied, setCopied] = useState(false)
  const url = shareToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${invoiceShareHref(shareToken)}`
    : null

  const handleCopy = useCallback(() => {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [url])

  return (
    <div className='space-y-2'>
      <Label htmlFor='invoice-client-link' className='font-medium'>
        Client link
      </Label>
      <div className='flex items-center gap-1'>
        {url ? (
          <Input
            id='invoice-client-link'
            value={url}
            readOnly
            className='text-xs'
          />
        ) : (
          <p
            id='invoice-client-link'
            className='text-muted-foreground flex h-9 w-full min-w-0 items-center rounded-md border border-dashed px-3 text-xs'
          >
            Created when you send the invoice.
          </p>
        )}
        <RowActionButton
          type='button'
          label='Copy link'
          icon={copied ? <Check className='text-success' /> : <Copy />}
          onClick={handleCopy}
          disabled={!url}
        />
        {url ? (
          <RowActionButton
            type='button'
            label='Open link'
            icon={<ExternalLink />}
            onClick={() => window.open(url, '_blank')}
          />
        ) : (
          <RowActionButton
            type='button'
            label='Preview as client'
            icon={<SquareArrowOutUpRight />}
            onClick={() => window.open(invoicePreviewHref(invoiceId), '_blank')}
          />
        )}
      </div>
    </div>
  )
}
