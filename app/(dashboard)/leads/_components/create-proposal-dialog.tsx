'use client'

import { useCallback, useState, useTransition } from 'react'
import { FileText, DollarSign, CalendarDays, Loader2 } from 'lucide-react'
import { addDays, format } from 'date-fns'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import type { LeadRecord } from '@/lib/leads/types'
import type { Proposal } from '@/lib/queries/proposals'

import { createProposal } from '../_actions'

type CreateProposalDialogProps = {
  lead: LeadRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (proposal: Proposal) => void
}

// Use key-based remounting to reset form state when dialog opens
export function CreateProposalDialog({
  lead,
  open,
  onOpenChange,
  onSuccess,
}: CreateProposalDialogProps) {
  // Key changes when dialog opens to remount form and reset state
  const [formKey, setFormKey] = useState(0)

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setFormKey(k => k + 1)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <CreateProposalDialogContent
        key={formKey}
        lead={lead}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    </Dialog>
  )
}

function CreateProposalDialogContent({
  lead,
  onOpenChange,
  onSuccess,
}: Omit<CreateProposalDialogProps, 'open'>) {
  const { toast } = useToast()
  const [isCreating, startCreateTransition] = useTransition()

  // Form fields with defaults computed once on mount
  const [templateDocUrl, setTemplateDocUrl] = useState('')
  const [title, setTitle] = useState(
    () => `Proposal for ${lead.companyName || lead.contactName}`
  )
  const [estimatedValue, setEstimatedValue] = useState(
    () => lead.estimatedValue?.toString() ?? ''
  )
  const [expirationDate, setExpirationDate] = useState(
    () => format(addDays(new Date(), 30), 'yyyy-MM-dd')
  )

  const handleCreate = useCallback(() => {
    if (!templateDocUrl.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing template',
        description: 'Please enter a Google Docs template URL.',
      })
      return
    }

    if (!title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing title',
        description: 'Please enter a proposal title.',
      })
      return
    }

    const parsedValue = estimatedValue ? parseFloat(estimatedValue) : undefined

    startCreateTransition(async () => {
      const result = await createProposal({
        leadId: lead.id,
        templateDocUrl: templateDocUrl.trim(),
        title: title.trim(),
        estimatedValue: parsedValue,
        expirationDate: expirationDate
          ? new Date(expirationDate).toISOString()
          : undefined,
      })

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to create proposal',
          description: result.error ?? 'Please try again.',
        })
        return
      }

      toast({
        title: 'Proposal created',
        description: `${title} - Document ready in Google Docs.`,
      })

      onOpenChange(false)
      if (result.proposal) {
        onSuccess?.(result.proposal)
      }
    })
  }, [
    lead.id,
    templateDocUrl,
    title,
    estimatedValue,
    expirationDate,
    toast,
    onOpenChange,
    onSuccess,
  ])

  const canCreate = templateDocUrl.trim() && title.trim() && !isCreating

  return (
    <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Proposal
          </DialogTitle>
          <DialogDescription>
            Create a new proposal document for {lead.contactName}
            {lead.companyName && ` at ${lead.companyName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Template URL */}
          <div className="space-y-2">
            <Label htmlFor="template-url">Template Document URL</Label>
            <Input
              id="template-url"
              value={templateDocUrl}
              onChange={e => setTemplateDocUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
            />
            <p className="text-xs text-muted-foreground">
              Paste a Google Docs URL to use as a template. Variables like{' '}
              <code className="rounded bg-muted px-1">{'{{contact_name}}'}</code> will be
              replaced.
            </p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="proposal-title">Proposal Title</Label>
            <Input
              id="proposal-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Proposal title"
            />
          </div>

          {/* Estimated Value */}
          <div className="space-y-2">
            <Label htmlFor="estimated-value" className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Estimated Value (optional)
            </Label>
            <Input
              id="estimated-value"
              type="number"
              min="0"
              step="100"
              value={estimatedValue}
              onChange={e => setEstimatedValue(e.target.value)}
              placeholder="10000"
            />
            <p className="text-xs text-muted-foreground">
              Used for{' '}
              <code className="rounded bg-muted px-1">{'{{proposed_value}}'}</code>{' '}
              variable
            </p>
          </div>

          {/* Expiration Date */}
          <div className="space-y-2">
            <Label htmlFor="expiration-date" className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Expiration Date (optional)
            </Label>
            <Input
              id="expiration-date"
              type="date"
              value={expirationDate}
              onChange={e => setExpirationDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
            <p className="text-xs text-muted-foreground">
              Used for{' '}
              <code className="rounded bg-muted px-1">{'{{expiration_date}}'}</code>{' '}
              variable
            </p>
          </div>

          {/* Template Variables Reference */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium">Available Variables</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              <code>{'{{contact_name}}'}</code>
              <code>{'{{first_name}}'}</code>
              <code>{'{{company_name}}'}</code>
              <code>{'{{sender_name}}'}</code>
              <code>{'{{sender_email}}'}</code>
              <code>{'{{proposal_date}}'}</code>
              <code>{'{{expiration_date}}'}</code>
              <code>{'{{proposed_value}}'}</code>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Create Proposal
              </>
            )}
          </Button>
        </DialogFooter>
    </DialogContent>
  )
}
