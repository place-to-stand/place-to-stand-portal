'use client'

import { useState, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { escapeHtml } from '@/lib/email/compose-utils'
import type { ComposeContext } from '../compose-panel'

interface FormState {
  toEmails: string[]
  ccEmails: string[]
  bccEmails: string[]
  subject: string
  body: string
}

interface UseSendFlowOptions {
  formState: FormState
  scheduledAt: Date | null
  draftId: string | null
  context: ComposeContext
  connectionId?: string
  clearSaveTimeout: () => void
  saveDraft: () => Promise<string | null>
  onSent?: () => void
  onClose: () => void
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
}

interface UseSendFlowReturn {
  isSending: boolean
  undoCountdown: number | null
  handleSend: () => Promise<void>
  handleUndoSend: () => void
}

export function useSendFlow({
  formState,
  scheduledAt,
  draftId,
  context,
  connectionId,
  clearSaveTimeout,
  saveDraft,
  onSent,
  onClose,
  toast,
}: UseSendFlowOptions): UseSendFlowReturn {
  const { toEmails, ccEmails, bccEmails, subject, body } = formState

  const [isSending, setIsSending] = useState(false)
  const [undoCountdown, setUndoCountdown] = useState<number | null>(null)

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
    clearSaveTimeout()

    try {
      const endpoint = draftId
        ? `/api/integrations/gmail/drafts/${draftId}/send`
        : '/api/integrations/gmail/send'

      const payload = draftId
        ? {}
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
  }, [toEmails, ccEmails, bccEmails, subject, body, context, connectionId, draftId, clearSaveTimeout, toast, onSent, onClose])

  // Undo send countdown effect
  useEffect(() => {
    if (undoCountdown === null) return

    if (undoCountdown <= 0) {
      setUndoCountdown(null)
      performSend()
      return
    }

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
    clearSaveTimeout()

    // If scheduling, handle immediately (no undo for scheduled sends)
    if (scheduledAt) {
      try {
        let currentDraftId = draftId
        if (!currentDraftId) {
          currentDraftId = await saveDraft()
          if (!currentDraftId) {
            throw new Error('Failed to create draft for scheduling')
          }
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
  }, [toEmails, ccEmails, bccEmails, subject, body, scheduledAt, draftId, clearSaveTimeout, saveDraft, toast, onSent, onClose])

  return {
    isSending,
    undoCountdown,
    handleSend,
    handleUndoSend,
  }
}
