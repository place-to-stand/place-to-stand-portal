'use client'

import { useState, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { FileIcon, Trash2, Clock } from 'lucide-react'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/email/compose-utils'

import { ContactAutocomplete } from './contact-autocomplete'
import { ComposeHeader } from './compose-header'
import { ComposeFooter } from './compose-footer'
import { useDraftAutoSave } from './hooks/use-draft-auto-save'
import { useAttachments } from './hooks/use-attachments'
import { useSendFlow } from './hooks/use-send-flow'
import { useSignatures } from './hooks/use-signatures'
import { useScheduleSend } from './hooks/use-schedule-send'

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
  const [showCcBcc, setShowCcBcc] = useState(
    (context.cc?.length ?? 0) > 0 || context.mode === 'new'
  )

  // Discard confirmation state
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Schedule send hook
  const {
    scheduledAt,
    setScheduledAt,
    showSchedulePicker,
    setShowSchedulePicker,
    customScheduleDate,
    setCustomScheduleDate,
    handleCustomScheduleConfirm,
  } = useScheduleSend({ toast })

  // Signatures hook
  const {
    signatures,
    selectedSignature,
    isLoadingSignatures,
    handleSignatureChange,
    clearSignature,
  } = useSignatures({
    mode: context.mode,
    isDraft: !!context.draftId,
    setBody,
  })

  // Draft auto-save hook
  const {
    draftId,
    saveStatus,
    lastSavedAt,
    saveDraft,
    hasUnsavedChanges,
    triggerAutoSave,
    clearSaveTimeout,
  } = useDraftAutoSave({
    enabled: enableAutoSave,
    context,
    formState: { toEmails, ccEmails, bccEmails, subject, body },
    connectionId,
  })

  // Attachments hook
  const {
    attachments,
    setAttachments,
    isUploadingAttachment,
    fileInputRef,
    handleFileSelect,
    handleRemoveAttachment,
  } = useAttachments({
    draftId,
    ensureDraftExists: saveDraft,
    toast,
  })

  // Send flow hook
  const {
    isSending,
    undoCountdown,
    handleSend,
    handleUndoSend,
  } = useSendFlow({
    formState: { toEmails, ccEmails, bccEmails, subject, body },
    scheduledAt,
    draftId,
    context,
    connectionId,
    clearSaveTimeout,
    saveDraft,
    onSent,
    onClose,
    toast,
  })

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
  }, [context.draftId, setAttachments])

  // Handle close attempt - check for unsaved changes first
  const handleCloseAttempt = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }, [hasUnsavedChanges, onClose])

  // Trigger auto-save when fields change
  useEffect(() => {
    triggerAutoSave()
  }, [toEmails, ccEmails, bccEmails, subject, body, triggerAutoSave])

  return (
    <div className={cn(
      'bg-background flex flex-col',
      inline
        ? 'rounded-lg border shadow-sm'  // Inline: card-like appearance within thread
        : 'h-full border-l'              // Panel: full height with left border
    )}>
      <ComposeHeader
        mode={context.mode}
        inline={inline}
        hideCloseButton={hideCloseButton}
        enableAutoSave={enableAutoSave}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        onClose={handleCloseAttempt}
      />

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
                    size='icon-sm'
                    className='flex-shrink-0'
                    onClick={() => handleRemoveAttachment(attachment.storageKey)}
                    disabled={isSending}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ComposeFooter
        inline={inline}
        isSending={isSending}
        fileInputRef={fileInputRef}
        handleFileSelect={handleFileSelect}
        isUploadingAttachment={isUploadingAttachment}
        signatures={signatures}
        selectedSignature={selectedSignature}
        isLoadingSignatures={isLoadingSignatures}
        handleSignatureChange={handleSignatureChange}
        clearSignature={clearSignature}
        scheduledAt={scheduledAt}
        setScheduledAt={setScheduledAt}
        setShowSchedulePicker={setShowSchedulePicker}
        undoCountdown={undoCountdown}
        handleSend={handleSend}
        handleUndoSend={handleUndoSend}
      />

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
              <Clock className='h-4 w-4' />
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
