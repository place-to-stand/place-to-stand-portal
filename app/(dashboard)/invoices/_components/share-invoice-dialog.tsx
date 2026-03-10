'use client'

import { useState, useCallback, useEffect } from 'react'
import { Copy, Check, Link2, Eye, Link2Off } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

type ShareInvoiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceNumber: string | null
  shareToken: string | null
  shareEnabled: boolean
  viewedCount: number
  onUpdate?: () => void
}

export function ShareInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  shareToken,
  shareEnabled,
  viewedCount,
  onUpdate,
}: ShareInvoiceDialogProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentToken, setCurrentToken] = useState(shareToken)
  const [currentEnabled, setCurrentEnabled] = useState(shareEnabled)

  useEffect(() => {
    setCurrentToken(shareToken)
    setCurrentEnabled(shareEnabled)
  }, [shareToken, shareEnabled])

  const shareUrl = currentToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/invoices/${currentToken}`
    : null

  const handleEnableSharing = useCallback(async () => {
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
        toast({
          title: 'Sharing enabled',
          description: 'The invoice link is ready to share.',
        })
        onUpdate?.()
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
  }, [invoiceId, toast, onUpdate])

  const handleDisableSharing = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/unshare`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.ok) {
        setCurrentEnabled(false)
        toast({ title: 'Sharing disabled' })
        onUpdate?.()
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
  }, [invoiceId, toast, onUpdate])

  const handleCopy = useCallback(() => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [shareUrl])

  const displayTitle = invoiceNumber ? `Invoice ${invoiceNumber}` : 'Invoice Draft'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Share Invoice</DialogTitle>
          <DialogDescription className='truncate'>
            {displayTitle}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {currentEnabled && shareUrl ? (
            <>
              <div className='space-y-2'>
                <Label>Shareable Link</Label>
                <div className='flex gap-2'>
                  <Input value={shareUrl} readOnly className='text-xs' />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
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

              {viewedCount > 0 && (
                <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                  <Eye className='h-4 w-4' />
                  Viewed {viewedCount} time{viewedCount !== 1 ? 's' : ''}
                </div>
              )}

              <Button
                variant='outline'
                className='w-full'
                onClick={handleDisableSharing}
                disabled={isLoading}
              >
                <Link2Off className='mr-2 h-4 w-4' />
                Disable Sharing
              </Button>
            </>
          ) : (
            <Button
              className='w-full'
              onClick={handleEnableSharing}
              disabled={isLoading}
            >
              <Link2 className='mr-2 h-4 w-4' />
              {isLoading ? 'Generating link...' : 'Generate Shareable Link'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
