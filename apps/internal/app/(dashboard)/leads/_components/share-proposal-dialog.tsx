'use client'

import { useState, useCallback, useEffect } from 'react'
import { Copy, Check, Link2, Eye, Lock, Unlock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

type ShareProposalDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposalId: string
  proposalTitle: string
  shareToken: string | null
  shareEnabled: boolean | null
  viewedCount: number | null
  onUpdate?: () => void
}

export function ShareProposalDialog({
  open,
  onOpenChange,
  proposalId,
  proposalTitle,
  shareToken,
  shareEnabled,
  viewedCount,
  onUpdate,
}: ShareProposalDialogProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [currentToken, setCurrentToken] = useState(shareToken)
  const [currentEnabled, setCurrentEnabled] = useState(shareEnabled ?? false)

  // Sync local state when props change (e.g., after data refresh)
  useEffect(() => {
    setCurrentToken(shareToken)
    setCurrentEnabled(shareEnabled ?? false)
  }, [shareToken, shareEnabled])

  const shareUrl = currentToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/proposals/${currentToken}`
    : null

  const handleEnableSharing = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: usePassword ? password : null }),
      })
      const data = await res.json()
      if (data.ok) {
        setCurrentToken(data.data.shareToken)
        setCurrentEnabled(true)
        toast({ title: 'Sharing enabled', description: 'The proposal link is ready to share.' })
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
  }, [proposalId, password, usePassword, toast, onUpdate])

  const handleDisableSharing = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/unshare`, {
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
  }, [proposalId, toast, onUpdate])

  const handleCopy = useCallback(() => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [shareUrl])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Proposal</DialogTitle>
          <DialogDescription className="truncate">{proposalTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {currentEnabled && shareUrl ? (
            <>
              <div className="space-y-2">
                <Label>Shareable Link</Label>
                <div className="flex gap-2">
                  <Input value={shareUrl} readOnly className="text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {viewedCount != null && viewedCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  Viewed {viewedCount} time{viewedCount !== 1 ? 's' : ''}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={handleDisableSharing}
                disabled={isLoading}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Disable Sharing
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {usePassword ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Unlock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Label htmlFor="use-password">Password protect</Label>
                </div>
                <Switch
                  id="use-password"
                  checked={usePassword}
                  onCheckedChange={setUsePassword}
                />
              </div>

              {usePassword && (
                <div className="space-y-2">
                  <Label htmlFor="share-password">Password</Label>
                  <Input
                    id="share-password"
                    type="text"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter a password for the link"
                  />
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleEnableSharing}
                disabled={isLoading || (usePassword && !password)}
              >
                <Link2 className="mr-2 h-4 w-4" />
                {isLoading ? 'Generating link...' : 'Generate Shareable Link'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
