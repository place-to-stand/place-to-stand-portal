'use client'

import { useState, useCallback, useEffect } from 'react'
import { Copy, Check, Link2, Link2Off } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

type InvoiceShareSectionProps = {
  invoiceId: string
  shareToken: string | null
  shareEnabled: boolean
  invoiceStatus?: string
  onShareStateChange?: (enabled: boolean) => void
  onSendInvoice?: () => void
}

export function InvoiceShareSection({
  invoiceId,
  shareToken,
  shareEnabled,
  invoiceStatus,
  onShareStateChange,
  onSendInvoice,
}: InvoiceShareSectionProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentToken, setCurrentToken] = useState(shareToken)
  const [currentEnabled, setCurrentEnabled] = useState(shareEnabled)
  const [showSendPrompt, setShowSendPrompt] = useState(false)

  useEffect(() => {
    setCurrentToken(shareToken)
    setCurrentEnabled(shareEnabled)
  }, [shareToken, shareEnabled])

  const shareUrl = currentToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/invoices/${currentToken}`
    : null

  const handleEnableSharing = useCallback(async () => {
    const isFirstGeneration = !currentToken
    setIsLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.ok) {
        setCurrentToken(data.data.shareToken)
        setCurrentEnabled(true)
        onShareStateChange?.(true)
        toast({
          title: 'Sharing enabled',
          description: 'The invoice link is ready to share.',
        })
        if (isFirstGeneration && invoiceStatus === 'DRAFT' && onSendInvoice) {
          setShowSendPrompt(true)
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to enable sharing',
          description: data.error ?? 'Please try again.',
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to enable sharing',
        description: 'Network error. Please check your connection.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [invoiceId, toast])

  const handleDisableSharing = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/unshare`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.ok) {
        setCurrentEnabled(false)
        onShareStateChange?.(false)
        toast({ title: 'Sharing disabled' })
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to disable sharing',
          description: data.error ?? 'Please try again.',
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to disable sharing',
        description: 'Network error. Please check your connection.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [invoiceId, toast])

  const handleCopy = useCallback(() => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [shareUrl])

  const handleConfirmSend = useCallback(() => {
    setShowSendPrompt(false)
    onSendInvoice?.()
  }, [onSendInvoice])

  const handleDeclineSend = useCallback(() => {
    setShowSendPrompt(false)
  }, [])

  return (
    <div className='space-y-4'>
      <ConfirmDialog
        open={showSendPrompt}
        title='Mark invoice as sent?'
        description='The invoice must be marked as sent before the client can make a payment. Would you like to mark it as sent now?'
        confirmLabel='Mark as Sent'
        cancelLabel='Not Now'
        onConfirm={handleConfirmSend}
        onCancel={handleDeclineSend}
      />
      <span className='mb-2 block text-sm font-medium'>Share Link</span>
      {currentEnabled && shareUrl ? (
        <div className='space-y-3'>
          <div className='space-y-1.5'>
            <Label className='sr-only'>Shareable Link</Label>
            <div className='flex gap-2'>
              <Input value={shareUrl} readOnly tabIndex={-1} className='text-xs' />
              <Button
                type='button'
                variant='outline'
                size='icon'
                className='flex-shrink-0'
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className='h-4 w-4 text-green-600' />
                ) : (
                  <Copy className='h-4 w-4' />
                )}
              </Button>
            </div>
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='w-full'
            onClick={handleDisableSharing}
            disabled={isLoading}
          >
            <Link2Off className='mr-2 h-4 w-4' />
            Disable Sharing
          </Button>
        </div>
      ) : (
        <Button
          type='button'
          size='sm'
          className='w-full'
          onClick={handleEnableSharing}
          disabled={isLoading}
        >
          <Link2 className='mr-2 h-4 w-4' />
          {isLoading ? 'Generating link...' : 'Generate Shareable Link'}
        </Button>
      )}
    </div>
  )
}
