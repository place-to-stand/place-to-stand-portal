'use client'

import { useCallback, useState, useTransition } from 'react'
import { Target, Loader2 } from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

import { createLeadFromThread } from './actions/create-lead-from-thread'

type CreateLeadFromThreadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  threadId: string
  senderEmail: string
  senderName: string | null
  subject: string | null
  onSuccess?: (leadId: string) => void
}

/**
 * Extract company name from email domain.
 * e.g., "john@acme-corp.com" -> "Acme Corp"
 */
function extractCompanyFromEmail(email: string): string | null {
  const domainMatch = email.match(/@([^.]+)/)
  if (!domainMatch) return null

  const domain = domainMatch[1]
  // Skip common email providers
  const providers = ['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'aol', 'proton', 'protonmail']
  if (providers.includes(domain.toLowerCase())) return null

  // Convert domain to title case (e.g., "acme-corp" -> "Acme Corp")
  return domain
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Extract display name from full name or email.
 */
function extractDisplayName(name: string | null, email: string): string {
  if (name) {
    return name
  }

  // Fall back to email local part
  const localPart = email.split('@')[0]
  return localPart
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// Use key-based remounting to reset form state when dialog opens
export function CreateLeadFromThreadDialog({
  open,
  onOpenChange,
  threadId,
  senderEmail,
  senderName,
  subject,
  onSuccess,
}: CreateLeadFromThreadDialogProps) {
  // Key changes when dialog opens to reset internal state
  const [formKey, setFormKey] = useState(0)

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        // Increment key to remount form and reset state
        setFormKey(k => k + 1)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <CreateLeadFromThreadDialogContent
        key={formKey}
        threadId={threadId}
        senderEmail={senderEmail}
        senderName={senderName}
        subject={subject}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    </Dialog>
  )
}

function CreateLeadFromThreadDialogContent({
  threadId,
  senderEmail,
  senderName,
  subject,
  onOpenChange,
  onSuccess,
}: Omit<CreateLeadFromThreadDialogProps, 'open'>) {
  const { toast } = useToast()
  const [isCreating, startCreateTransition] = useTransition()

  // Form fields with defaults computed once on mount
  const [contactName, setContactName] = useState(() => extractDisplayName(senderName, senderEmail))
  const [contactEmail, setContactEmail] = useState(() => senderEmail.toLowerCase())
  const [companyName, setCompanyName] = useState(() => extractCompanyFromEmail(senderEmail) || '')
  const [notes, setNotes] = useState(() => (subject ? `Initial inquiry: ${subject}` : ''))

  const handleCreate = useCallback(() => {
    if (!contactName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing name',
        description: 'Please enter a contact name.',
      })
      return
    }

    if (!contactEmail.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing email',
        description: 'Please enter a contact email.',
      })
      return
    }

    startCreateTransition(async () => {
      const result = await createLeadFromThread({
        threadId,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        companyName: companyName.trim() || null,
        notes: notes.trim() || null,
      })

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to create lead',
          description: result.error ?? 'Please try again.',
        })
        return
      }

      toast({
        title: 'Lead created',
        description: `${contactName} has been added to your pipeline.`,
      })

      onOpenChange(false)
      if (result.leadId) {
        onSuccess?.(result.leadId)
      }
    })
  }, [
    threadId,
    contactName,
    contactEmail,
    companyName,
    notes,
    toast,
    onOpenChange,
    onSuccess,
  ])

  const canCreate = contactName.trim() && contactEmail.trim() && !isCreating

  return (
    <DialogContent className='sm:max-w-[450px]'>
      <DialogHeader>
        <DialogTitle className='flex items-center gap-2'>
          <Target className='h-5 w-5' />
          Create Lead from Email
        </DialogTitle>
        <DialogDescription>
          Create a new lead and link this email thread to track the conversation.
        </DialogDescription>
      </DialogHeader>

      <div className='flex flex-col gap-4 py-4'>
        {/* Contact Name */}
        <div className='space-y-2'>
          <Label htmlFor='contact-name'>Contact Name</Label>
          <Input
            id='contact-name'
            value={contactName}
            onChange={e => setContactName(e.target.value)}
            placeholder='John Smith'
          />
        </div>

        {/* Contact Email */}
        <div className='space-y-2'>
          <Label htmlFor='contact-email'>Email</Label>
          <Input
            id='contact-email'
            type='email'
            value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
            placeholder='john@example.com'
          />
        </div>

        {/* Company Name */}
        <div className='space-y-2'>
          <Label htmlFor='company-name'>Company (optional)</Label>
          <Input
            id='company-name'
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder='Acme Corp'
          />
        </div>

        {/* Notes */}
        <div className='space-y-2'>
          <Label htmlFor='notes'>Notes (optional)</Label>
          <Textarea
            id='notes'
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder='Initial context about this lead...'
            rows={3}
          />
        </div>

        <p className='text-xs text-muted-foreground'>
          The lead will be created in &quot;New Opportunities&quot; status and this
          email thread will be linked automatically.
        </p>
      </div>

      <DialogFooter>
        <Button
          variant='outline'
          onClick={() => onOpenChange(false)}
          disabled={isCreating}
        >
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={!canCreate}>
          {isCreating ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Creating...
            </>
          ) : (
            <>
              <Target className='mr-2 h-4 w-4' />
              Create Lead
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
