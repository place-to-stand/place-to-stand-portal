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
  // Counts resets (open, save, task switch): the delta they clear was never
  // an edit, so the undo stack takes it as its new start.
  const [deltaResetCount, setDeltaResetCount] = useState(0)
  // Every file uploaded this session, kept (with its preview) until a reset
  // or the sheet closing: undo and redo can bring back one removed from the
  // list. Removing a new file only takes it off the list.
  const pendingPathsRef = useRef<Set<string>>(new Set())
  const previewUrlRef = useRef<Map<string, string>>(new Map())

  const { handleAttachmentUpload, pendingUploadCount, resetPendingUploads } =
    useAttachmentUploader({
      canManage,
      taskId,
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

  // The new files on the list now, read by a reset after a save.
  const pendingDraftsRef = useRef(pendingDrafts)
  useEffect(() => {
    pendingDraftsRef.current = pendingDrafts
  })

  const resetAttachmentsState = useCallback(
    (options?: { preservePending?: boolean }) => {
      // After a save the files on the list were attached: keep those. Every
      // other upload (taken off the list, or all of them on a discard) goes.
      const attached = new Set(
        options?.preservePending
          ? pendingDraftsRef.current.map(draft => draft.storagePath)
          : []
      )
      const unused = Array.from(pendingPathsRef.current).filter(
        path => !attached.has(path)
      )
      pendingPathsRef.current.clear()
      cleanupPendingAttachments(unused)

      clearPreviewUrls()
      setPendingDrafts([])
      setAttachmentsToRemove([])
      setDeltaResetCount(count => count + 1)
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
        attachmentsToRemove
      ),
    [attachments, attachmentsToRemove, persistedAttachments]
  )

  // Switching tasks drops the previous task's unsaved delta during render
  // (adjust-state-during-render); the effect below handles the refs.
  const [prevTaskId, setPrevTaskId] = useState(taskId)
  if (prevTaskId !== taskId) {
    setPrevTaskId(taskId)
    setPendingDrafts([])
    setAttachmentsToRemove([])
    setDeltaResetCount(count => count + 1)
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
        // Off the list only: the file stays until a reset or the sheet
        // closing, so undo can put it back.
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
    [attachments]
  )

  // Removed saved files stay in their place as Pending removal until Save.
  const attachmentItems = useMemo<AttachmentItem[]>(
    () =>
      toAttachmentItems(
        [...persistedAttachments, ...pendingDrafts],
        attachmentsToRemove
      ),
    [attachmentsToRemove, pendingDrafts, persistedAttachments]
  )

  const handleAttachmentUndoRemove = useCallback(
    (key: string) => {
      const target = persistedAttachments.find(
        attachment => makeAttachmentKey(attachment) === key
      )
      if (!target?.id) return
      const targetId = target.id
      setAttachmentsToRemove(prev => prev.filter(id => id !== targetId))
    },
    [persistedAttachments]
  )

  const isUploading = pendingUploadCount > 0

  const attachmentsHistoryState = useMemo(
    () => ({ added: pendingDrafts, removedIds: attachmentsToRemove }),
    [attachmentsToRemove, pendingDrafts]
  )
  const restoreAttachmentsHistory = useCallback(
    (state: { added: AttachmentDraft[]; removedIds: string[] }) => {
      setPendingDrafts(state.added)
      setAttachmentsToRemove(state.removedIds)
    },
    []
  )

  const buildSubmissionPayload = useCallback(
    () => buildAttachmentSubmission(attachments, attachmentsToRemove),
    [attachments, attachmentsToRemove]
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
    handleAttachmentUndoRemove,
    resetAttachmentsState,
    buildSubmissionPayload,
    attachmentsHistory: {
      state: attachmentsHistoryState,
      restore: restoreAttachmentsHistory,
      savedKey: deltaResetCount,
    },
  }
}

export type {
  AttachmentItem,
  UseTaskAttachmentsArgs,
  UseTaskAttachmentsReturn,
} from './types'
