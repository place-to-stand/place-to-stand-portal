'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { buildDefaultAttachments } from './default-attachments'
import {
  UPLOAD_ENDPOINT,
  type AttachmentDraft,
  type AttachmentItem,
  type UseTaskAttachmentsArgs,
  type UseTaskAttachmentsReturn,
} from './types'
import {
  attachmentsAreDirty,
  buildAttachmentSubmission,
  makeAttachmentKey,
  toAttachmentItems,
} from './attachment-transformers'
import { useAttachmentUploader } from './use-attachment-uploader'

const NO_ATTACHMENTS: AttachmentDraft[] = []

type AttachmentRow = {
  id: string
  storage_path: string
  original_name: string
  mime_type: string
  file_size: number | null
}

const toPersistedDraft = (attachment: AttachmentRow): AttachmentDraft => ({
  id: attachment.id,
  storagePath: attachment.storage_path,
  originalName: attachment.original_name,
  mimeType: attachment.mime_type,
  fileSize: Number(attachment.file_size ?? 0),
  isPending: false,
  downloadUrl: `/api/storage/task-attachment/${attachment.id}`,
  previewUrl: null,
})

/**
 * Persisted attachments are always derived — from the task prop when it
 * carries them, otherwise from a per-task fetch (board rows only carry
 * `attachmentCount`). The only state is the unsaved delta: new uploads and
 * removals. A reset clears the delta and never writes a list, so a reset
 * queued in a transition cannot land after the fetch and blank the sheet —
 * which is what made attachments intermittently vanish on open.
 */
export const useTaskAttachments = ({
  task,
  canManage,
  toast,
}: UseTaskAttachmentsArgs): UseTaskAttachmentsReturn => {
  const taskId = task?.id ?? null
  const inlineAttachments = useMemo(() => buildDefaultAttachments(task), [task])
  const hasInlineAttachments = inlineAttachments.length > 0

  const [fetched, setFetched] = useState<{
    taskId: string
    attachments: AttachmentDraft[]
  } | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const persistedAttachments = useMemo(() => {
    if (hasInlineAttachments) {
      return inlineAttachments
    }
    return fetched && fetched.taskId === taskId
      ? fetched.attachments
      : NO_ATTACHMENTS
  }, [fetched, hasInlineAttachments, inlineAttachments, taskId])

  const [pendingDrafts, setPendingDrafts] = useState<AttachmentDraft[]>([])
  const [attachmentsToRemove, setAttachmentsToRemove] = useState<string[]>([])
  const pendingPathsRef = useRef<Set<string>>(new Set())
  const previewUrlRef = useRef<Map<string, string>>(new Map())

  const { handleAttachmentUpload, pendingUploadCount, resetPendingUploads } =
    useAttachmentUploader({
      canManage,
      toast,
      setAttachments: setPendingDrafts,
      pendingPathsRef,
      previewUrlRef,
    })

  const attachments = useMemo(
    () => [
      ...persistedAttachments.filter(
        attachment =>
          !attachment.id || !attachmentsToRemove.includes(attachment.id)
      ),
      ...pendingDrafts,
    ],
    [attachmentsToRemove, pendingDrafts, persistedAttachments]
  )

  const cleanupPendingAttachments = useCallback((paths: string[]) => {
    if (!paths.length) {
      return
    }

    void Promise.all(
      paths.map(async path => {
        try {
          await fetch(UPLOAD_ENDPOINT, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path }),
          })
        } catch (error) {
          console.error('Failed to clean up pending attachment', error)
        }
      })
    )
  }, [])

  const clearPreviewUrls = useCallback(() => {
    previewUrlRef.current.forEach(url => {
      URL.revokeObjectURL(url)
    })
    previewUrlRef.current.clear()
  }, [])

  const resetAttachmentsState = useCallback(
    (options?: { preservePending?: boolean }) => {
      const pendingPaths = Array.from(pendingPathsRef.current)
      pendingPathsRef.current.clear()

      if (!options?.preservePending && pendingPaths.length) {
        cleanupPendingAttachments(pendingPaths)
      }

      clearPreviewUrls()
      setPendingDrafts([])
      setAttachmentsToRemove([])
      resetPendingUploads()

      // A save just changed what is persisted; reload so reopening the task
      // shows it without waiting on the board's refreshed count.
      if (options?.preservePending) {
        setRefreshToken(token => token + 1)
      }
    },
    [cleanupPendingAttachments, clearPreviewUrls, resetPendingUploads]
  )

  const attachmentsDirty = useMemo(
    () =>
      attachmentsAreDirty(
        attachments,
        persistedAttachments,
        attachmentsToRemove,
      ),
    [attachments, attachmentsToRemove, persistedAttachments],
  )

  // Switching tasks drops the previous task's unsaved delta during render
  // (adjust-state-during-render); the effect below handles the refs.
  const [prevTaskId, setPrevTaskId] = useState(taskId)
  if (prevTaskId !== taskId) {
    setPrevTaskId(taskId)
    setPendingDrafts([])
    setAttachmentsToRemove([])
    resetPendingUploads()
  }

  useEffect(() => {
    pendingPathsRef.current.clear()
    clearPreviewUrls()
  }, [clearPreviewUrls, taskId])

  const attachmentCount = task?.attachmentCount ?? 0

  useEffect(() => {
    if (!taskId || hasInlineAttachments) {
      return
    }

    const controller = new AbortController()

    fetch(`/api/v1/tasks/${taskId}/attachments`, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(payload?.error ?? 'Unable to load attachments.')
        }

        const payload = (await response.json()) as {
          attachments?: AttachmentRow[]
        }

        if (controller.signal.aborted) {
          return
        }

        setFetched({
          taskId,
          attachments: (payload.attachments ?? []).map(toPersistedDraft),
        })
      })
      .catch(error => {
        if (controller.signal.aborted) {
          return
        }
        console.error('Failed to load task attachments', error)
      })

    return () => {
      controller.abort()
    }
    // `attachmentCount` and `refreshToken` are refetch triggers: the board's
    // count moving, or a save having just changed what is persisted.
  }, [attachmentCount, hasInlineAttachments, refreshToken, taskId])

  const handleAttachmentRemove = useCallback(
    (key: string) => {
      const target = attachments.find(
        attachment => makeAttachmentKey(attachment) === key
      )

      if (!target) {
        return
      }

      if (target.isPending) {
        pendingPathsRef.current.delete(target.storagePath)
        cleanupPendingAttachments([target.storagePath])
        if (target.previewUrl) {
          URL.revokeObjectURL(target.previewUrl)
        }
        previewUrlRef.current.delete(target.storagePath)
        setPendingDrafts(prev =>
          prev.filter(attachment => makeAttachmentKey(attachment) !== key)
        )
      } else if (target.id) {
        const targetId = target.id
        setAttachmentsToRemove(prev =>
          prev.includes(targetId) ? prev : [...prev, targetId]
        )
      }
    },
    [attachments, cleanupPendingAttachments]
  )

  const attachmentItems = useMemo<AttachmentItem[]>(
    () => toAttachmentItems(attachments),
    [attachments],
  )

  const isUploading = pendingUploadCount > 0

  const buildSubmissionPayload = useCallback(
    () => buildAttachmentSubmission(attachments, attachmentsToRemove),
    [attachments, attachmentsToRemove],
  )

  useEffect(() => {
    const pendingPathSet = pendingPathsRef.current
    return () => {
      const pendingPaths = Array.from(pendingPathSet)
      pendingPathSet.clear()
      if (pendingPaths.length) {
        cleanupPendingAttachments(pendingPaths)
      }
      clearPreviewUrls()
    }
  }, [cleanupPendingAttachments, clearPreviewUrls])

  return {
    attachmentItems,
    attachmentsDirty,
    isUploading,
    handleAttachmentUpload,
    handleAttachmentRemove,
    resetAttachmentsState,
    buildSubmissionPayload,
  }
}

export type {
  AttachmentItem,
  UseTaskAttachmentsArgs,
  UseTaskAttachmentsReturn,
} from './types'
