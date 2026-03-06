'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import type { ThreadSummary, Message } from '@/lib/types/messages'
import type { CidMapping } from '@/lib/email/sanitize'
import type { ClientSuggestion, LeadSuggestion } from '@/lib/email/suggestions'

import { AttachmentMetadata } from './attachment-viewer'
import { BatchToolbar } from './batch-toolbar'
import { ThreadDetailSheet } from './thread-detail-sheet'
import { TriageRow } from './triage-row'
import { useBatchSelection } from './hooks/use-batch-selection'

export type TriageThread = ThreadSummary & {
  clientSuggestion: ClientSuggestion | null
  leadSuggestion: LeadSuggestion | null
}

type Client = { id: string; name: string; slug: string | null }
type Project = { id: string; name: string; slug: string | null; clientId: string | null; type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'; ownerId: string | null; createdBy: string | null }
type Lead = { id: string; contactName: string; contactEmail: string | null }

interface TriageViewProps {
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  currentUserId: string
  /** Server-side unclassified count — triggers queue refetch when it changes (e.g. after sync) */
  serverQueueSize: number
}

export function TriageView({ clients, projects, leads, currentUserId, serverQueueSize }: TriageViewProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [queue, setQueue] = useState<TriageThread[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sessionStats, setSessionStats] = useState({ classified: 0, dismissed: 0 })
  const [analyzeQueue, setAnalyzeQueue] = useState<Set<string>>(new Set())

  // Thread detail sheet state (lightweight — no URL sync)
  const [selectedThread, setSelectedThread] = useState<ThreadSummary | null>(null)
  const [threadMessages, setThreadMessages] = useState<Message[]>([])
  const [cidMappings, setCidMappings] = useState<Record<string, CidMapping[]>>({})
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, AttachmentMetadata[]>>({})
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleViewThread = useCallback(async (thread: ThreadSummary) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSelectedThread(thread)
    setIsLoadingMessages(true)
    setThreadMessages([])
    setCidMappings({})
    setAttachmentsMap({})

    try {
      const res = await fetch(`/api/threads/${thread.id}/messages`, {
        signal: controller.signal,
      })
      if (res.ok) {
        const data = await res.json()
        setThreadMessages(data.messages || [])
        setCidMappings(data.cidMappings || {})
        setAttachmentsMap(data.attachments || {})
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Failed to load messages:', err)
    } finally {
      setIsLoadingMessages(false)
    }
  }, [])

  const handleCloseSheet = useCallback(() => {
    abortRef.current?.abort()
    setSelectedThread(null)
    setThreadMessages([])
    setCidMappings({})
    setAttachmentsMap({})
  }, [])

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

  // Adapt leads for ThreadDetailSheet (triage has contactEmail, sheet doesn't need it)
  const sheetLeads = useMemo(
    () => leads.map(l => ({ id: l.id, contactName: l.contactName })),
    [leads]
  )

  // Adapt projects for ThreadDetailSheet (triage has clientId, sheet needs clientSlug)
  const sheetProjects = useMemo(
    () => projects.map(p => {
      const client = clients.find(c => c.id === p.clientId)
      return { id: p.id, name: p.name, slug: p.slug, clientSlug: client?.slug ?? null, type: p.type, ownerId: p.ownerId, createdBy: p.createdBy }
    }),
    [projects, clients]
  )

  // Dummy setThreads for sheet — queue uses different state management
  const setThreadsForSheet = useCallback((updater: React.SetStateAction<ThreadSummary[]>) => {
    // The triage queue is separate from the inbox thread list,
    // so we update the queue state instead
    setQueue(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      return next as TriageThread[]
    })
  }, [])

  const threadIds = useMemo(() => queue.map(t => t.id), [queue])
  const {
    selectedCount,
    toggle,
    selectAll,
    clearSelection,
    isSelected,
    selectedIds,
  } = useBatchSelection(threadIds)

  const fetchQueue = useCallback(async (offset = 0) => {
    if (offset === 0) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }
    setFetchError(null)
    try {
      const res = await fetch(`/api/triage?limit=50&offset=${offset}`)
      if (res.ok) {
        const data = await res.json()
        setHasMore(data.hasMore)
        if (offset === 0) {
          setQueue(data.threads)
        } else {
          setQueue(prev => [...prev, ...data.threads])
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        const message = errorData.error || `Failed to load triage queue (${res.status})`
        console.error('Triage fetch error:', { status: res.status, error: message })
        setFetchError(message)
      }
    } catch (err) {
      console.error('Triage fetch error:', err)
      setFetchError('Failed to connect to server')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // Re-fetch queue when server-side count increases (e.g. after Gmail sync).
  // Ignore decreases — those are from the user classifying/dismissing items,
  // which are already handled optimistically by removing from the queue.
  const prevServerQueueSize = useRef(serverQueueSize)
  useEffect(() => {
    if (serverQueueSize > prevServerQueueSize.current) {
      fetchQueue()
    }
    prevServerQueueSize.current = serverQueueSize
  }, [serverQueueSize, fetchQueue])

  const handleAccept = useCallback(async (
    threadId: string,
    linkData: { clientId?: string; projectId?: string; leadId?: string }
  ) => {
    const res = await fetch(`/api/threads/${threadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...linkData, classification: 'CLASSIFIED' }),
    })

    if (res.ok) {
      setSessionStats(prev => ({ ...prev, classified: prev.classified + 1 }))
      setQueue(prev => prev.filter(t => t.id !== threadId))
      router.refresh()
    }
  }, [router])

  const handleDismiss = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/threads/${threadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classification: 'DISMISSED' }),
    })

    if (res.ok) {
      setSessionStats(prev => ({ ...prev, dismissed: prev.dismissed + 1 }))
      setQueue(prev => prev.filter(t => t.id !== threadId))
      router.refresh()
    }
  }, [router])

  const handleBatchAnalyze = useCallback(() => {
    setAnalyzeQueue(new Set(selectedIds))
  }, [selectedIds])

  const handleAnalyzeStarted = useCallback((threadId: string) => {
    setAnalyzeQueue(prev => {
      const next = new Set(prev)
      next.delete(threadId)
      return next
    })
  }, [])

  const handleBatchDismiss = useCallback(async () => {
    const ids = Array.from(selectedIds)
    const res = await fetch('/api/threads/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', threadIds: ids }),
    })

    if (res.ok) {
      setSessionStats(prev => ({ ...prev, dismissed: prev.dismissed + ids.length }))
      setQueue(prev => prev.filter(t => !selectedIds.has(t.id)))
      clearSelection()
      router.refresh()
      toast({
        title: `Dismissed ${ids.length} thread${ids.length !== 1 ? 's' : ''}`,
      })
    }
  }, [selectedIds, clearSelection, router, toast])

  const totalProcessed = sessionStats.classified + sessionStats.dismissed

  if (isLoading) {
    return (
      <section className='bg-background flex min-h-[calc(100vh-13rem)] items-center justify-center overflow-hidden rounded-xl border shadow-sm'>
        <div className='flex flex-col items-center p-12'>
          <div className='border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent' />
          <p className='text-muted-foreground mt-4 text-sm'>Loading triage queue...</p>
        </div>
      </section>
    )
  }

  if (fetchError) {
    return (
      <section className='bg-background flex min-h-[calc(100vh-13rem)] items-center justify-center overflow-hidden rounded-xl border shadow-sm'>
        <div className='flex flex-col items-center p-12 text-center'>
          <Inbox className='text-muted-foreground mb-4 h-12 w-12' />
          <h3 className='text-lg font-medium'>Unable to load triage queue</h3>
          <p className='text-muted-foreground mt-1 text-sm'>{fetchError}</p>
          <button onClick={() => fetchQueue()} className='text-primary mt-4 text-sm underline'>
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (queue.length === 0) {
    return (
      <section className='bg-background flex min-h-[calc(100vh-13rem)] items-center justify-center overflow-hidden rounded-xl border shadow-sm'>
        <div className='flex flex-col items-center p-12 text-center'>
          <CheckCircle className='text-green-500 mb-4 h-12 w-12' />
          <h3 className='text-lg font-medium'>All caught up!</h3>
          <p className='text-muted-foreground mt-1 text-sm'>
            {totalProcessed > 0
              ? `Great work! You classified ${sessionStats.classified} and dismissed ${sessionStats.dismissed} threads this session.`
              : 'No unclassified threads to review.'}
          </p>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className='bg-background flex min-h-[calc(100vh-13rem)] min-w-0 flex-col overflow-hidden rounded-xl border shadow-sm'>
        {/* Toolbar */}
        <div className='flex items-center justify-between border-b px-4 py-3'>
          <div className='flex items-center gap-3'>
            <Checkbox
              checked={selectedCount === queue.length && queue.length > 0}
              onCheckedChange={checked => {
                if (checked) selectAll()
                else clearSelection()
              }}
              className='h-4 w-4'
            />
            <span className='text-muted-foreground text-sm'>
              {selectedCount > 0
                ? `${selectedCount} of ${queue.length} selected`
                : `${queue.length} unclassified thread${queue.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          {totalProcessed > 0 && (
            <span className='text-muted-foreground text-sm'>
              Classified {sessionStats.classified} · Dismissed {sessionStats.dismissed}
            </span>
          )}
        </div>

        {/* Thread list */}
        <div className='flex-1 divide-y'>
          {queue.map(thread => (
            <TriageRow
              key={thread.id}
              thread={thread}
              clients={clients}
              projects={projects}
              leads={leads}
              currentUserId={currentUserId}
              isChecked={isSelected(thread.id)}
              shouldAnalyze={analyzeQueue.has(thread.id)}
              onAnalyzeStarted={() => handleAnalyzeStarted(thread.id)}
              onToggle={(shiftKey) => toggle(thread.id, shiftKey)}
              onAccept={handleAccept}
              onDismiss={() => handleDismiss(thread.id)}
              onViewThread={handleViewThread}
            />
          ))}
        </div>

        {/* Load more */}
        {hasMore && (
          <div className='border-t px-4 py-3 text-center'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => fetchQueue(queue.length)}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? 'Loading...' : 'Load more'}
            </Button>
          </div>
        )}
      </section>

      <BatchToolbar
        selectedCount={selectedCount}
        onAnalyze={handleBatchAnalyze}
        onDismiss={handleBatchDismiss}
        onClear={clearSelection}
      />

      {/* Thread Detail Sheet — opens when clicking a triage row */}
      <ThreadDetailSheet
        selectedThread={selectedThread}
        threadMessages={threadMessages}
        cidMappings={cidMappings}
        attachmentsMap={attachmentsMap}
        isLoadingMessages={isLoadingMessages}
        isAdmin
        currentUserId={currentUserId}
        clients={clients}
        projects={sheetProjects}
        leads={sheetLeads}
        canGoPrev={false}
        canGoNext={false}
        onPrev={() => {}}
        onNext={() => {}}
        composeContext={null}
        setComposeContext={() => {}}
        onReply={() => {}}
        onRefreshMessages={refreshMessages}
        setThreadMessages={setThreadMessages}
        setThreads={setThreadsForSheet}
        setSelectedThread={setSelectedThread}
        setViewingAttachment={() => {}}
        onClose={handleCloseSheet}
      />
    </>
  )
}
