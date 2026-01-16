'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { addHours, addDays, setHours, setMinutes, format, startOfTomorrow, parseISO } from 'date-fns'
import { X, Send, Paperclip, Loader2, Check, Cloud, Clock, ChevronDown, FileIcon, Trash2, Calendar, Signature } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

import { ContactAutocomplete } from './contact-autocomplete'

/** Attachment metadata (matches server type) */
interface AttachmentMetadata {
  storageKey: string
  filename: string
  mimeType: string
  size: number
}

/** Signature metadata from Gmail */
interface SignatureData {
  email: string
  displayName: string
  signature: string
  isPrimary: boolean
  isDefault: boolean
}

export type ComposeMode = 'reply' | 'reply_all' | 'forward' | 'new'

export interface ComposeContext {
  mode: ComposeMode
  /** Portal thread ID for replies */
  threadId?: string
  /** Gmail message ID being replied to */
  inReplyToMessageId?: string
  /** Pre-filled recipients */
  to?: string[]
  cc?: string[]
  /** Pre-filled subject (for replies: "Re: ..." ) */
  subject?: string
  /** Original message body for quoting */
  quotedBody?: string
  /** Client ID to pre-link */
  clientId?: string
  /** Project ID to pre-link */
  projectId?: string
  /** Existing draft ID to resume */
  draftId?: string
}

interface ComposePanelProps {
  context: ComposeContext
  connectionId?: string
  onClose: () => void
  onSent?: () => void
  /** Hide the header close button (use when rendered inside a Sheet that has its own close) */
  hideCloseButton?: boolean
  /** Enable auto-save to drafts */
  enableAutoSave?: boolean
  /** Render in compact inline mode (Gmail-style, within thread) */
  inline?: boolean
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function ComposePanel({
  context,
  connectionId,
  onClose,
  onSent,
  hideCloseButton = false,
  enableAutoSave = true,
  inline = false,
}: ComposePanelProps) {
  const { toast } = useToast()

  const [toEmails, setToEmails] = useState<string[]>(context.to || [])
  const [ccEmails, setCcEmails] = useState<string[]>(context.cc || [])
  const [bccEmails, setBccEmails] = useState<string[]>([])
  const [subject, setSubject] = useState(context.subject || '')
  const [body, setBody] = useState(
    context.quotedBody ? `\n\n---\n${context.quotedBody}` : ''
  )
  const [isSending, setIsSending] = useState(false)
  const [showCcBcc, setShowCcBcc] = useState(
    (context.cc?.length ?? 0) > 0 || context.mode === 'new'
  )

  // Undo send state (5 second countdown)
  const [undoCountdown, setUndoCountdown] = useState<number | null>(null)

  // Scheduled send state
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null)
  const [showSchedulePicker, setShowSchedulePicker] = useState(false)
  const [customScheduleDate, setCustomScheduleDate] = useState('')

  // Attachment state
  const [attachments, setAttachments] = useState<AttachmentMetadata[]>([])
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Signature state
  const [signatures, setSignatures] = useState<SignatureData[]>([])
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null)
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false)
  const signatureAppendedRef = useRef(false)

  // Auto-save state
  const [draftId, setDraftId] = useState<string | null>(context.draftId || null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isCreatingDraftRef = useRef(false)
  const pendingSaveRef = useRef(false) // Track if save is needed after creation completes

  // Discard confirmation state
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Track last saved content to detect unsaved changes
  const lastSavedContentRef = useRef<{
    toEmails: string[]
    ccEmails: string[]
    bccEmails: string[]
    subject: string
    body: string
  } | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Load draft data if resuming an existing draft
  useEffect(() => {
    if (!context.draftId) return

    const loadDraft = async () => {
      try {
        const res = await fetch(`/api/integrations/gmail/drafts/${context.draftId}`)
        if (res.ok) {
          const data = await res.json()
          const draft = data.draft
          if (draft) {
            setToEmails(draft.toEmails || [])
            setCcEmails(draft.ccEmails || [])
            setBccEmails(draft.bccEmails || [])
            setSubject(draft.subject || '')
            setBody(draft.bodyText || '')
            setAttachments(draft.attachments || [])
            // Show Cc/Bcc if there are values
            if ((draft.ccEmails?.length > 0) || (draft.bccEmails?.length > 0)) {
              setShowCcBcc(true)
            }
          }
        }
      } catch (err) {
        console.error('Failed to load draft:', err)
      }
    }

    loadDraft()
  }, [context.draftId])

  // Fetch signatures on mount
  useEffect(() => {
    const fetchSignatures = async () => {
      setIsLoadingSignatures(true)
      try {
        const res = await fetch('/api/integrations/gmail/signatures')
        if (res.ok) {
          const data = await res.json()
          const sigs = data.signatures as SignatureData[]
          setSignatures(sigs)

          // Select default or primary signature
          const defaultSig = sigs.find(s => s.isDefault) || sigs.find(s => s.isPrimary)
          if (defaultSig) {
            setSelectedSignature(defaultSig.email)
          }
        }
      } catch (err) {
        console.error('Failed to fetch signatures:', err)
      } finally {
        setIsLoadingSignatures(false)
      }
    }

    fetchSignatures()
  }, [])

  // Auto-append signature for new emails (runs once when signature is selected)
  useEffect(() => {
    if (signatureAppendedRef.current) return
    if (context.draftId) return // Don't append to existing drafts
    if (!selectedSignature || signatures.length === 0) return

    const sig = signatures.find(s => s.email === selectedSignature)
    if (!sig || !sig.signature) return

    // Only auto-append for new emails
    if (context.mode !== 'new') return

    signatureAppendedRef.current = true
    // Add signature with separator
    const separator = '\n\n--\n'
    // Strip HTML tags from signature for plain text display - use safer approach
    const plainSignature = stripHtmlTags(sig.signature)
    setBody(prev => {
      const trimmed = prev.trim()
      if (trimmed) {
        return prev + separator + plainSignature
      }
      return separator + plainSignature
    })
  }, [selectedSignature, signatures, context.mode, context.draftId]) // Removed body dependency

  // Handle signature change - uses signature separator marker for reliable replacement
  const handleSignatureChange = useCallback((email: string) => {
    const newSig = signatures.find(s => s.email === email)

    setBody(prev => {
      // Look for signature separator marker to find and replace signature block
      const separatorPattern = /\n\n--\n[\s\S]*$/
      const hasExistingSignature = separatorPattern.test(prev)

      if (newSig?.signature) {
        const newPlainSig = stripHtmlTags(newSig.signature)
        const separator = '\n\n--\n'

        if (hasExistingSignature) {
          // Replace everything after the separator
          return prev.replace(separatorPattern, separator + newPlainSig)
        }
        // Append new signature
        return prev + separator + newPlainSig
      } else {
        // No signature selected - remove existing signature block
        if (hasExistingSignature) {
          return prev.replace(separatorPattern, '')
        }
        return prev
      }
    })

    setSelectedSignature(email)
  }, [signatures])

  // Handle file upload
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // We need a draft ID to upload attachments
    let currentDraftId = draftId

    if (!currentDraftId) {
      // Create draft first
      setIsUploadingAttachment(true)
      try {
        const res = await fetch('/api/integrations/gmail/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId,
            threadId: context.threadId,
            composeType: context.mode,
            inReplyToMessageId: context.inReplyToMessageId,
            toEmails,
            ccEmails,
            bccEmails,
            subject,
            bodyText: body,
            clientId: context.clientId,
            projectId: context.projectId,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          currentDraftId = data.draft.id
          setDraftId(currentDraftId)
        } else {
          throw new Error('Failed to create draft')
        }
      } catch (err) {
        toast({
          title: 'Error',
          description: 'Failed to create draft for attachment',
          variant: 'destructive',
        })
        setIsUploadingAttachment(false)
        return
      }
    }

    // Upload each file
    setIsUploadingAttachment(true)
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`/api/integrations/gmail/drafts/${currentDraftId}/attachments`, {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          const data = await res.json()
          setAttachments(data.attachments)
        } else {
          const errorData = await res.json().catch(() => ({}))
          toast({
            title: 'Upload failed',
            description: errorData.error || `Failed to upload ${file.name}`,
            variant: 'destructive',
          })
        }
      } catch (err) {
        toast({
          title: 'Upload failed',
          description: `Failed to upload ${file.name}`,
          variant: 'destructive',
        })
      }
    }
    setIsUploadingAttachment(false)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [draftId, connectionId, context, toEmails, ccEmails, bccEmails, subject, body, toast])

  // Handle attachment removal
  const handleRemoveAttachment = useCallback(async (storageKey: string) => {
    if (!draftId) return

    try {
      const res = await fetch(`/api/integrations/gmail/drafts/${draftId}/attachments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageKey }),
      })

      if (res.ok) {
        const data = await res.json()
        setAttachments(data.attachments)
      } else {
        throw new Error('Failed to remove attachment')
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to remove attachment',
        variant: 'destructive',
      })
    }
  }, [draftId, toast])

  // Handle custom schedule confirmation
  const handleCustomScheduleConfirm = useCallback(() => {
    if (!customScheduleDate) return
    const date = parseISO(customScheduleDate)
    if (date > new Date()) {
      setScheduledAt(date)
      setShowSchedulePicker(false)
      setCustomScheduleDate('')
    } else {
      toast({
        title: 'Invalid date',
        description: 'Please select a date in the future',
        variant: 'destructive',
      })
    }
  }, [customScheduleDate, toast])

  // Auto-save function with race condition protection
  const saveDraft = useCallback(async () => {
    if (!enableAutoSave) return

    // Don't save if no meaningful content
    const hasContent =
      toEmails.length > 0 || subject.trim() || body.trim()
    if (!hasContent) return

    // If draft is being created, mark that we need to save after
    if (isCreatingDraftRef.current) {
      pendingSaveRef.current = true
      return
    }

    setSaveStatus('saving')

    try {
      if (!draftId) {
        // Create new draft
        isCreatingDraftRef.current = true
        const res = await fetch('/api/integrations/gmail/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId,
            threadId: context.threadId,
            composeType: context.mode,
            inReplyToMessageId: context.inReplyToMessageId,
            toEmails,
            ccEmails,
            bccEmails,
            subject,
            bodyText: body,
            bodyHtml: body
              ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${escapeHtml(body)}</div>`
              : undefined,
            clientId: context.clientId,
            projectId: context.projectId,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          const newDraftId = data.draft.id
          setDraftId(newDraftId)
          setSaveStatus('saved')
          setLastSavedAt(new Date())
          // Track saved content for unsaved changes detection
          lastSavedContentRef.current = { toEmails, ccEmails, bccEmails, subject, body }

          // Check if we need to save again with updated content
          isCreatingDraftRef.current = false
          if (pendingSaveRef.current) {
            pendingSaveRef.current = false
            // Trigger another save after a short delay
            setTimeout(() => saveDraft(), 100)
          }
        } else {
          setSaveStatus('error')
          isCreatingDraftRef.current = false
        }
      } else {
        // Update existing draft
        const res = await fetch(`/api/integrations/gmail/drafts/${draftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmails,
            ccEmails,
            bccEmails,
            subject,
            bodyText: body,
            bodyHtml: body
              ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${escapeHtml(body)}</div>`
              : undefined,
          }),
        })

        if (res.ok) {
          setSaveStatus('saved')
          setLastSavedAt(new Date())
          // Track saved content for unsaved changes detection
          lastSavedContentRef.current = { toEmails, ccEmails, bccEmails, subject, body }
        } else {
          setSaveStatus('error')
        }
      }
    } catch (err) {
      console.error('Failed to save draft:', err)
      setSaveStatus('error')
      isCreatingDraftRef.current = false
    }
  }, [
    enableAutoSave,
    draftId,
    toEmails,
    ccEmails,
    bccEmails,
    subject,
    body,
    context,
    connectionId,
  ])

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    // No content = no unsaved changes
    const hasContent = toEmails.length > 0 || subject.trim() || body.trim()
    if (!hasContent) return false

    // Never saved = has unsaved changes if there's content
    if (!lastSavedContentRef.current) return hasContent

    // Compare current content to last saved
    const saved = lastSavedContentRef.current
    return (
      JSON.stringify(toEmails) !== JSON.stringify(saved.toEmails) ||
      JSON.stringify(ccEmails) !== JSON.stringify(saved.ccEmails) ||
      JSON.stringify(bccEmails) !== JSON.stringify(saved.bccEmails) ||
      subject !== saved.subject ||
      body !== saved.body
    )
  }, [toEmails, ccEmails, bccEmails, subject, body])

  // Handle close attempt - check for unsaved changes first
  const handleCloseAttempt = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }, [hasUnsavedChanges, onClose])

  // Debounced auto-save trigger
  const triggerAutoSave = useCallback(() => {
    if (!enableAutoSave) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDraft()
    }, 2000) // 2 second debounce
  }, [enableAutoSave, saveDraft])

  // Trigger auto-save when fields change
  useEffect(() => {
    triggerAutoSave()
  }, [toEmails, ccEmails, bccEmails, subject, body, triggerAutoSave])

  // Cancel undo countdown
  const handleUndoSend = useCallback(() => {
    setUndoCountdown(null)
    setIsSending(false)
    toast({
      title: 'Send cancelled',
      description: 'Your email was not sent.',
    })
  }, [toast])

  // Actually perform the send (called after undo countdown or for scheduled sends)
  const performSend = useCallback(async () => {
    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    try {
      // If we have a draft, send via draft endpoint (marks as sent)
      // Otherwise send directly
      const endpoint = draftId
        ? `/api/integrations/gmail/drafts/${draftId}/send`
        : '/api/integrations/gmail/send'

      const payload = draftId
        ? {} // Draft endpoint uses stored data
        : {
            connectionId,
            to: toEmails,
            cc: ccEmails,
            bcc: bccEmails,
            subject: subject.trim(),
            bodyText: body,
            bodyHtml: `<div style="font-family: sans-serif; white-space: pre-wrap;">${escapeHtml(body)}</div>`,
            threadId: context.threadId,
            inReplyToMessageId: context.inReplyToMessageId,
            clientId: context.clientId,
            projectId: context.projectId,
            draftId,
          }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send email')
      }

      toast({
        title: 'Email sent',
        description: 'Your email has been sent successfully.',
      })

      onSent?.()
      onClose()
    } catch (err) {
      toast({
        title: 'Failed to send',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }, [
    toEmails,
    ccEmails,
    bccEmails,
    subject,
    body,
    context,
    connectionId,
    draftId,
    toast,
    onSent,
    onClose,
  ])

  // Undo send countdown effect - must be after performSend is defined
  useEffect(() => {
    if (undoCountdown === null) return

    if (undoCountdown <= 0) {
      // Countdown finished, actually send
      setUndoCountdown(null)
      performSend()
      return
    }

    // Decrement countdown every second
    const timer = setTimeout(() => {
      setUndoCountdown(prev => (prev !== null ? prev - 1 : null))
    }, 1000)

    return () => clearTimeout(timer)
  }, [undoCountdown, performSend])

  const handleSend = useCallback(async () => {
    if (toEmails.length === 0) {
      toast({
        title: 'Missing recipients',
        description: 'Please enter at least one recipient.',
        variant: 'destructive',
      })
      return
    }

    if (!subject.trim()) {
      toast({
        title: 'Missing subject',
        description: 'Please enter a subject.',
        variant: 'destructive',
      })
      return
    }

    setIsSending(true)

    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // If scheduling, handle immediately (no undo for scheduled sends)
    if (scheduledAt) {
      try {
        // Ensure we have a draft to schedule
        let currentDraftId = draftId
        if (!currentDraftId) {
          // Create a new draft first
          const createRes = await fetch('/api/integrations/gmail/drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connectionId,
              threadId: context.threadId,
              composeType: context.mode,
              inReplyToMessageId: context.inReplyToMessageId,
              toEmails,
              ccEmails,
              bccEmails,
              subject,
              bodyText: body,
              bodyHtml: body
                ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${escapeHtml(body)}</div>`
                : undefined,
              clientId: context.clientId,
              projectId: context.projectId,
            }),
          })
          if (!createRes.ok) {
            throw new Error('Failed to create draft for scheduling')
          }
          const createData = await createRes.json()
          currentDraftId = createData.draft.id
        }

        // Update draft with READY status and scheduled time
        const res = await fetch(`/api/integrations/gmail/drafts/${currentDraftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmails,
            ccEmails,
            bccEmails,
            subject,
            bodyText: body,
            bodyHtml: body
              ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${escapeHtml(body)}</div>`
              : undefined,
            status: 'READY',
            scheduledAt: scheduledAt.toISOString(),
          }),
        })

        if (!res.ok) {
          throw new Error('Failed to schedule email')
        }

        toast({
          title: 'Email scheduled',
          description: `Your email will be sent ${format(scheduledAt, 'PPp')}.`,
        })

        onSent?.()
        onClose()
      } catch (err) {
        toast({
          title: 'Failed to schedule',
          description: err instanceof Error ? err.message : 'Please try again.',
          variant: 'destructive',
        })
      } finally {
        setIsSending(false)
      }
      return
    }

    // For immediate sends, start 5-second undo countdown
    setUndoCountdown(5)
  }, [
    toEmails,
    ccEmails,
    bccEmails,
    subject,
    body,
    context,
    connectionId,
    draftId,
    scheduledAt,
    toast,
    onSent,
    onClose,
  ])

  const modeLabel =
    context.mode === 'reply'
      ? 'Reply'
      : context.mode === 'reply_all'
        ? 'Reply All'
        : context.mode === 'forward'
          ? 'Forward'
          : 'New Email'

  return (
    <div className={cn(
      'bg-background flex flex-col',
      inline
        ? 'rounded-lg border shadow-sm'  // Inline: card-like appearance within thread
        : 'h-full border-l'              // Panel: full height with left border
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between border-b',
        inline ? 'px-4 py-2' : 'px-4 py-3'
      )}>
        <div className='flex items-center gap-2'>
          <h3 className='font-semibold'>{modeLabel}</h3>
          {/* Save status indicator */}
          {enableAutoSave && saveStatus !== 'idle' && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs',
                saveStatus === 'saving' && 'text-muted-foreground',
                saveStatus === 'saved' && 'text-green-600',
                saveStatus === 'error' && 'text-destructive'
              )}
            >
              {saveStatus === 'saving' && (
                <>
                  <Cloud className='h-3 w-3 animate-pulse' />
                  Saving...
                </>
              )}
              {saveStatus === 'saved' && lastSavedAt && (
                <>
                  <Check className='h-3 w-3' />
                  Saved at {format(lastSavedAt, 'h:mm a')}
                </>
              )}
              {saveStatus === 'error' && 'Save failed'}
            </span>
          )}
        </div>
        {!hideCloseButton && (
          <Button variant='ghost' size='icon' onClick={handleCloseAttempt}>
            <X className='h-4 w-4' />
          </Button>
        )}
      </div>

      {/* Form */}
      <div className={cn(
        'space-y-4',
        inline ? 'p-4' : 'flex-1 overflow-y-auto p-4'
      )}>
        {/* To */}
        <div className='space-y-1.5'>
          <div className='flex items-center justify-between'>
            <Label>To</Label>
            {!showCcBcc && (
              <Button
                type='button'
                variant='link'
                size='sm'
                className='h-auto p-0 text-xs'
                onClick={() => setShowCcBcc(true)}
              >
                Cc/Bcc
              </Button>
            )}
          </div>
          <ContactAutocomplete
            value={toEmails}
            onChange={setToEmails}
            placeholder='Add recipients...'
            disabled={isSending}
          />
        </div>

        {/* Cc/Bcc */}
        {showCcBcc && (
          <>
            <div className='space-y-1.5'>
              <Label>Cc</Label>
              <ContactAutocomplete
                value={ccEmails}
                onChange={setCcEmails}
                placeholder='Add Cc recipients...'
                disabled={isSending}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Bcc</Label>
              <ContactAutocomplete
                value={bccEmails}
                onChange={setBccEmails}
                placeholder='Add Bcc recipients...'
                disabled={isSending}
              />
            </div>
          </>
        )}

        {/* Subject */}
        <div className='space-y-1.5'>
          <Label htmlFor='subject'>Subject</Label>
          <Input
            id='subject'
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder='Subject'
            disabled={isSending}
          />
        </div>

        {/* Body */}
        <div className='space-y-1.5'>
          <Label htmlFor='body'>Message</Label>
          <Textarea
            id='body'
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder='Write your message...'
            className={cn(
              'resize-none',
              inline ? 'min-h-[120px]' : 'min-h-[200px]'
            )}
            disabled={isSending}
          />
        </div>

        {/* Attachments list */}
        {attachments.length > 0 && (
          <div className='space-y-1.5'>
            <Label>Attachments</Label>
            <div className='space-y-2'>
              {attachments.map(attachment => (
                <div
                  key={attachment.storageKey}
                  className='bg-muted flex items-center gap-2 rounded-md px-3 py-2'
                >
                  <FileIcon className='text-muted-foreground h-4 w-4 flex-shrink-0' />
                  <span className='min-w-0 flex-1 truncate text-sm'>
                    {attachment.filename}
                  </span>
                  <span className='text-muted-foreground flex-shrink-0 text-xs'>
                    {formatFileSize(attachment.size)}
                  </span>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-6 w-6 flex-shrink-0 p-0'
                    onClick={() => handleRemoveAttachment(attachment.storageKey)}
                    disabled={isSending}
                  >
                    <Trash2 className='h-3 w-3' />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={cn(
        'flex items-center justify-between border-t',
        inline ? 'px-4 py-2' : 'px-4 py-3'
      )}>
        <div className='flex items-center gap-2'>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type='file'
            multiple
            className='hidden'
            onChange={handleFileSelect}
            accept='.jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.html,.zip,.mp4,.mov'
          />
          <Button
            variant='outline'
            size='sm'
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || isUploadingAttachment}
          >
            {isUploadingAttachment ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Uploading...
              </>
            ) : (
              <>
                <Paperclip className='mr-2 h-4 w-4' />
                Attach
              </>
            )}
          </Button>

          {/* Signature selector */}
          {signatures.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={isSending || isLoadingSignatures}
                >
                  {isLoadingSignatures ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <Signature className='mr-2 h-4 w-4' />
                  )}
                  Signature
                  <ChevronDown className='ml-2 h-3 w-3' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start'>
                {signatures.map(sig => (
                  <DropdownMenuItem
                    key={sig.email}
                    onClick={() => handleSignatureChange(sig.email)}
                    className='flex items-center gap-2'
                  >
                    {selectedSignature === sig.email && (
                      <Check className='h-4 w-4' />
                    )}
                    <span className={cn(selectedSignature !== sig.email && 'ml-6')}>
                      {sig.displayName || sig.email}
                      {sig.isPrimary && (
                        <span className='text-muted-foreground ml-1 text-xs'>(primary)</span>
                      )}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    // Remove signature using the separator pattern
                    setBody(prev => prev.replace(/\n\n--\n[\s\S]*$/, ''))
                    setSelectedSignature(null)
                  }}
                  className='text-muted-foreground'
                >
                  <span className='ml-6'>No signature</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className='flex items-center gap-2'>
          {/* Scheduled time indicator */}
          {scheduledAt && (
            <div className='flex items-center gap-1 text-sm'>
              <Clock className='text-muted-foreground h-4 w-4' />
              <span className='text-muted-foreground'>
                {format(scheduledAt, 'MMM d, h:mm a')}
              </span>
              <Button
                variant='ghost'
                size='sm'
                className='h-6 px-2'
                onClick={() => setScheduledAt(null)}
                disabled={isSending}
              >
                <X className='h-3 w-3' />
              </Button>
            </div>
          )}

          {/* Send / Schedule buttons */}
          <div className='flex'>
            {undoCountdown !== null ? (
              // Show undo button during countdown
              <Button
                variant='destructive'
                onClick={handleUndoSend}
                className='gap-2'
              >
                <span className='tabular-nums'>Sending in {undoCountdown}s</span>
                <span className='font-semibold'>Undo</span>
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={isSending}
                className={cn(scheduledAt ? 'rounded-r-none' : '')}
              >
                {isSending ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    {scheduledAt ? 'Scheduling...' : 'Sending...'}
                  </>
                ) : scheduledAt ? (
                  <>
                    <Clock className='mr-2 h-4 w-4' />
                    Schedule
                  </>
                ) : (
                  <>
                    <Send className='mr-2 h-4 w-4' />
                    Send
                  </>
                )}
              </Button>
            )}

            {!scheduledAt && undoCountdown === null && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='default'
                    size='icon'
                    className='rounded-l-none border-l'
                    disabled={isSending}
                  >
                    <ChevronDown className='h-4 w-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem
                    onClick={() => setScheduledAt(addHours(new Date(), 1))}
                  >
                    <Clock className='mr-2 h-4 w-4' />
                    Send in 1 hour
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setScheduledAt(addHours(new Date(), 2))}
                  >
                    <Clock className='mr-2 h-4 w-4' />
                    Send in 2 hours
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      setScheduledAt(setMinutes(setHours(startOfTomorrow(), 8), 0))
                    }
                  >
                    <Clock className='mr-2 h-4 w-4' />
                    Tomorrow morning (8 AM)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setScheduledAt(addDays(new Date(), 1))}
                  >
                    <Clock className='mr-2 h-4 w-4' />
                    Tomorrow (same time)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      setScheduledAt(setMinutes(setHours(addDays(new Date(), 0), 17), 0))
                    }
                  >
                    <Clock className='mr-2 h-4 w-4' />
                    Today at 5 PM
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowSchedulePicker(true)}>
                    <Calendar className='mr-2 h-4 w-4' />
                    Pick date & time...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Custom Schedule Picker Dialog */}
      <Dialog open={showSchedulePicker} onOpenChange={setShowSchedulePicker}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Schedule Send</DialogTitle>
            <DialogDescription>
              Choose when you want this email to be sent.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='schedule-datetime'>Date and Time</Label>
              <Input
                id='schedule-datetime'
                type='datetime-local'
                value={customScheduleDate}
                onChange={e => setCustomScheduleDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowSchedulePicker(false)}>
              Cancel
            </Button>
            <Button onClick={handleCustomScheduleConfirm} disabled={!customScheduleDate}>
              <Clock className='mr-2 h-4 w-4' />
              Set Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Unsaved Changes Confirmation */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              {draftId
                ? 'You have unsaved changes since your last save. Are you sure you want to close without saving?'
                : 'Your draft hasn\'t been saved yet. Are you sure you want to discard it?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDiscardConfirm(false)
                onClose()
              }}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>')
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Strips HTML tags from a string, converting common elements to plain text equivalents.
 * More robust than naive regex - handles line breaks, entities, and nested tags.
 */
function stripHtmlTags(html: string): string {
  return html
    // Convert line-breaking elements to newlines first
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    // Put URL links on their own line (common in signatures)
    .replace(/<a\s[^>]*href\s*=\s*["'][^"']*["'][^>]*>/gi, '\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    // Clean up multiple consecutive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
