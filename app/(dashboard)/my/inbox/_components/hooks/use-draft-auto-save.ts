'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { escapeHtml } from '@/lib/email/compose-utils'
import type { ComposeContext } from '../compose-panel'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface FormState {
  toEmails: string[]
  ccEmails: string[]
  bccEmails: string[]
  subject: string
  body: string
}

interface UseDraftAutoSaveOptions {
  enabled: boolean
  context: ComposeContext
  formState: FormState
  connectionId?: string
}

interface UseDraftAutoSaveReturn {
  draftId: string | null
  setDraftId: React.Dispatch<React.SetStateAction<string | null>>
  saveStatus: SaveStatus
  lastSavedAt: Date | null
  saveDraft: () => Promise<string | null>
  hasUnsavedChanges: () => boolean
  triggerAutoSave: () => void
  clearSaveTimeout: () => void
}

export function useDraftAutoSave({
  enabled,
  context,
  formState,
  connectionId,
}: UseDraftAutoSaveOptions): UseDraftAutoSaveReturn {
  const { toEmails, ccEmails, bccEmails, subject, body } = formState

  const [draftId, setDraftId] = useState<string | null>(context.draftId || null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isCreatingDraftRef = useRef(false)
  const pendingSaveRef = useRef(false)

  // Track last saved content to detect unsaved changes
  const lastSavedContentRef = useRef<FormState | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const clearSaveTimeout = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
  }, [])

  // Auto-save function with race condition protection
  const saveDraft = useCallback(async (): Promise<string | null> => {
    if (!enabled) return draftId

    // Don't save if no meaningful content
    const hasContent = toEmails.length > 0 || subject.trim() || body.trim()
    if (!hasContent) return draftId

    // If draft is being created, mark that we need to save after
    if (isCreatingDraftRef.current) {
      pendingSaveRef.current = true
      return draftId
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
          lastSavedContentRef.current = { toEmails, ccEmails, bccEmails, subject, body }

          isCreatingDraftRef.current = false
          if (pendingSaveRef.current) {
            pendingSaveRef.current = false
            // Return now, let caller handle pending save
          }
          return newDraftId
        } else {
          setSaveStatus('error')
          isCreatingDraftRef.current = false
          return null
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
          lastSavedContentRef.current = { toEmails, ccEmails, bccEmails, subject, body }
          return draftId
        } else {
          setSaveStatus('error')
          return draftId
        }
      }
    } catch (err) {
      console.error('Failed to save draft:', err)
      setSaveStatus('error')
      isCreatingDraftRef.current = false
      return draftId
    }
  }, [enabled, draftId, toEmails, ccEmails, bccEmails, subject, body, context, connectionId])

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback((): boolean => {
    const hasContent = toEmails.length > 0 || !!subject.trim() || !!body.trim()
    if (!hasContent) return false

    if (!lastSavedContentRef.current) return true

    const saved = lastSavedContentRef.current
    return (
      JSON.stringify(toEmails) !== JSON.stringify(saved.toEmails) ||
      JSON.stringify(ccEmails) !== JSON.stringify(saved.ccEmails) ||
      JSON.stringify(bccEmails) !== JSON.stringify(saved.bccEmails) ||
      subject !== saved.subject ||
      body !== saved.body
    )
  }, [toEmails, ccEmails, bccEmails, subject, body])

  // Debounced auto-save trigger
  const triggerAutoSave = useCallback(() => {
    if (!enabled) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDraft()
    }, 2000) // 2 second debounce
  }, [enabled, saveDraft])

  return {
    draftId,
    setDraftId,
    saveStatus,
    lastSavedAt,
    saveDraft,
    hasUnsavedChanges,
    triggerAutoSave,
    clearSaveTimeout,
  }
}
