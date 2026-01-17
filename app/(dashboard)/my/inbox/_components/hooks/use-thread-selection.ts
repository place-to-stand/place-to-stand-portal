'use client'

import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import type { ThreadSummary, Message } from '@/lib/types/messages'
import type { CidMapping } from '@/lib/email/sanitize'
import type { AttachmentMetadata } from '../attachment-viewer'

interface UseThreadSelectionOptions {
  threads: ThreadSummary[]
  initialSelectedThread: ThreadSummary | null | undefined
  searchParams: ReadonlyURLSearchParams
  router: AppRouterInstance
  setThreads: Dispatch<SetStateAction<ThreadSummary[]>>
}

interface UseThreadSelectionReturn {
  selectedThread: ThreadSummary | null
  setSelectedThread: Dispatch<SetStateAction<ThreadSummary | null>>
  threadMessages: Message[]
  setThreadMessages: Dispatch<SetStateAction<Message[]>>
  cidMappings: Record<string, CidMapping[]>
  attachmentsMap: Record<string, AttachmentMetadata[]>
  isLoadingMessages: boolean
  handleThreadClick: (thread: ThreadSummary, updateUrl?: boolean) => Promise<void>
  handleCloseSheet: () => void
  /** Refresh messages for the currently selected thread */
  refreshMessages: (threadId: string) => Promise<void>
}

export function useThreadSelection({
  threads,
  initialSelectedThread,
  searchParams,
  router,
  setThreads,
}: UseThreadSelectionOptions): UseThreadSelectionReturn {
  const [selectedThread, setSelectedThread] = useState<ThreadSummary | null>(null)
  const [threadMessages, setThreadMessages] = useState<Message[]>([])
  const [cidMappings, setCidMappings] = useState<Record<string, CidMapping[]>>({})
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, AttachmentMetadata[]>>({})
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  const handleThreadClick = useCallback(
    async (thread: ThreadSummary, updateUrl = true) => {
      setSelectedThread(thread)
      setIsLoadingMessages(true)
      setThreadMessages([])
      setCidMappings({})
      setAttachmentsMap({})

      // Update URL with thread ID
      if (updateUrl) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('thread', thread.id)
        router.push(`/my/inbox?${params.toString()}`, { scroll: false })
      }

      try {
        const res = await fetch(`/api/threads/${thread.id}/messages`)
        if (res.ok) {
          const data = await res.json()
          setThreadMessages(data.messages || [])
          setCidMappings(data.cidMappings || {})
          setAttachmentsMap(data.attachments || {})

          // Mark as read if there are unread messages
          const hasUnread = (data.messages || []).some(
            (m: Message) => !m.isRead
          )
          if (hasUnread) {
            // Fire and forget - don't block UI, but handle errors
            fetch(`/api/threads/${thread.id}/read`, { method: 'POST' })
              .then(res => {
                if (!res.ok) {
                  throw new Error(`Failed to mark as read: ${res.status}`)
                }
                // Update local thread state to show as read
                setThreads(prev =>
                  prev.map(t =>
                    t.id === thread.id && t.latestMessage
                      ? {
                          ...t,
                          latestMessage: { ...t.latestMessage, isRead: true },
                        }
                      : t
                  )
                )
                // Also update messages state
                setThreadMessages(prev =>
                  prev.map(m => ({ ...m, isRead: true }))
                )
              })
              .catch(err => {
                // Log error but don't disrupt UX - read status is non-critical
                console.error('Failed to mark thread as read:', err)
              })
          }
        }
      } catch (err) {
        console.error('Failed to load messages:', err)
      } finally {
        setIsLoadingMessages(false)
      }
    },
    [router, searchParams, setThreads]
  )

  const handleCloseSheet = useCallback(() => {
    setSelectedThread(null)
    setThreadMessages([])
    setCidMappings({})
    setAttachmentsMap({})

    // Remove thread from URL
    const params = new URLSearchParams(searchParams.toString())
    params.delete('thread')
    const newUrl = params.toString()
      ? `/my/inbox?${params.toString()}`
      : '/my/inbox'
    router.push(newUrl, { scroll: false })
  }, [router, searchParams])

  /** Refresh messages for a thread (e.g., after sending a reply) */
  const refreshMessages = useCallback(async (threadId: string) => {
    try {
      const res = await fetch(`/api/threads/${threadId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setThreadMessages(data.messages || [])
        setCidMappings(data.cidMappings || {})
        setAttachmentsMap(data.attachments || {})
      }
    } catch (err) {
      console.error('Failed to refresh messages:', err)
    }
  }, [])

  // Handle URL-based thread selection on mount and URL changes
  useEffect(() => {
    const threadId = searchParams.get('thread')
    if (threadId) {
      // First check if thread is in current page
      const thread = threads.find(t => t.id === threadId)
      if (thread && (!selectedThread || selectedThread.id !== threadId)) {
        handleThreadClick(thread, false) // Don't update URL since it's already set
      } else if (
        !thread &&
        initialSelectedThread &&
        initialSelectedThread.id === threadId &&
        (!selectedThread || selectedThread.id !== threadId)
      ) {
        // Thread not on current page but pre-fetched via deep-link
        handleThreadClick(initialSelectedThread, false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, threads, initialSelectedThread])

  return {
    selectedThread,
    setSelectedThread,
    threadMessages,
    setThreadMessages,
    cidMappings,
    attachmentsMap,
    isLoadingMessages,
    handleThreadClick,
    handleCloseSheet,
    refreshMessages,
  }
}
