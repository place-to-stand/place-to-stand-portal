'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  Building2,
  CheckCircle,
  FileText,
  Inbox,
  Loader2,
  Mail,
  Sparkles,
  UserCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import type { ThreadSummary, Message } from '@/lib/types/messages'
import type { CidMapping } from '@/lib/email/sanitize'
import type { ClientSuggestion, LeadSuggestion } from '@/lib/email/suggestions'
import type { TranscriptSummary } from '@/lib/queries/transcripts'

import { AttachmentMetadata } from './attachment-viewer'
import { BatchToolbar } from './batch-toolbar'
import { ClassifierControls } from './classifier-controls'
import { ThreadDetailSheet } from './thread-detail-sheet'
import { TranscriptDetailSheet } from './transcript-detail-sheet'
import { useBatchSelection } from './hooks/use-batch-selection'

// =============================================================================
// Types
// =============================================================================

type TriageEmailThread = ThreadSummary & {
  clientSuggestion: ClientSuggestion | null
  leadSuggestion: LeadSuggestion | null
}

type TriageEmail = {
  itemType: 'email'
  id: string
  sortDate: string | null
  thread: TriageEmailThread
}

type TriageTranscript = {
  itemType: 'transcript'
  id: string
  sortDate: string | null
  transcript: TranscriptSummary
}

type TriageItem = TriageEmail | TriageTranscript
type TypeFilter = 'all' | 'email' | 'transcript'

type Client = { id: string; name: string; slug: string | null }
type Project = { id: string; name: string; slug: string | null; clientId: string | null; type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'; ownerId: string | null; createdBy: string | null }
type Lead = { id: string; contactName: string; contactEmail: string | null }

interface TriageViewProps {
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  currentUserId: string
  serverQueueSize: number
}

// =============================================================================
// Component
// =============================================================================

export function TriageView({ clients, projects, leads, currentUserId, serverQueueSize }: TriageViewProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [queue, setQueue] = useState<TriageItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sessionStats, setSessionStats] = useState({ classified: 0, dismissed: 0 })
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [emailCount, setEmailCount] = useState(0)
  const [transcriptCount, setTranscriptCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  // Thread detail sheet state
  const [selectedThread, setSelectedThread] = useState<ThreadSummary | null>(null)
  const [threadMessages, setThreadMessages] = useState<Message[]>([])
  const [cidMappings, setCidMappings] = useState<Record<string, CidMapping[]>>({})
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, AttachmentMetadata[]>>({})
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Transcript detail sheet state
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptSummary | null>(null)

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

  const handleCloseThreadSheet = useCallback(() => {
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

  // Adapt leads for ThreadDetailSheet
  const sheetLeads = useMemo(
    () => leads.map(l => ({ id: l.id, contactName: l.contactName })),
    [leads]
  )

  // Adapt projects for ThreadDetailSheet
  const sheetProjects = useMemo(
    () => projects.map(p => {
      const client = clients.find(c => c.id === p.clientId)
      return { id: p.id, name: p.name, slug: p.slug, clientSlug: client?.slug ?? null, type: p.type, ownerId: p.ownerId, createdBy: p.createdBy }
    }),
    [projects, clients]
  )

  // Dummy setThreads for sheet — queue uses different state management
  const setThreadsForSheet = useCallback((updater: React.SetStateAction<ThreadSummary[]>) => {
    setQueue(prev => {
      const emailItems = prev.filter((item): item is TriageEmail => item.itemType === 'email')
      const next = typeof updater === 'function' ? updater(emailItems.map(e => e.thread)) : updater
      // Map updated threads back into queue items
      const updatedThreadMap = new Map(next.map(t => [t.id, t]))
      return prev.map(item => {
        if (item.itemType === 'email' && updatedThreadMap.has(item.id)) {
          return { ...item, thread: { ...item.thread, ...updatedThreadMap.get(item.id)! } }
        }
        return item
      })
    })
  }, [])

  // Filter queue by type
  const filteredQueue = useMemo(() => {
    if (typeFilter === 'all') return queue
    return queue.filter(item => item.itemType === typeFilter)
  }, [queue, typeFilter])

  const itemIds = useMemo(() => filteredQueue.map(t => t.id), [filteredQueue])
  const {
    selectedCount,
    toggle,
    selectAll,
    clearSelection,
    isSelected,
    selectedIds,
  } = useBatchSelection(itemIds)

  const fetchQueue = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/triage')
      if (res.ok) {
        const data = await res.json()
        setEmailCount(data.emailCount ?? 0)
        setTranscriptCount(data.transcriptCount ?? 0)
        setQueue(data.items)
        setHasMore(data.hasMore ?? false)
        setNextCursor(data.nextCursor ?? null)
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
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const params = new URLSearchParams({ cursor: nextCursor })
      const res = await fetch(`/api/triage?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEmailCount(prev => prev + (data.emailCount ?? 0))
        setTranscriptCount(prev => prev + (data.transcriptCount ?? 0))
        setQueue(prev => [...prev, ...data.items])
        setHasMore(data.hasMore ?? false)
        setNextCursor(data.nextCursor ?? null)
      }
    } catch (err) {
      console.error('Load more error:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [nextCursor, isLoadingMore])

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

  // --- Email handlers ---
  const handleAcceptEmail = useCallback(async (
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

  const handleDismissEmail = useCallback(async (threadId: string) => {
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

  // --- Transcript handlers ---
  const handleAcceptTranscript = useCallback(async (
    transcriptId: string,
    linkData: { clientId?: string; projectId?: string; leadId?: string }
  ) => {
    const res = await fetch(`/api/transcripts/${transcriptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...linkData, classification: 'CLASSIFIED' }),
    })
    if (res.ok) {
      setSessionStats(prev => ({ ...prev, classified: prev.classified + 1 }))
      setQueue(prev => prev.filter(t => t.id !== transcriptId))
      if (selectedTranscript?.id === transcriptId) setSelectedTranscript(null)
      router.refresh()
    }
  }, [selectedTranscript, router])

  const handleDismissTranscript = useCallback(async (transcriptId: string) => {
    const res = await fetch(`/api/transcripts/${transcriptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classification: 'DISMISSED' }),
    })
    if (res.ok) {
      setSessionStats(prev => ({ ...prev, dismissed: prev.dismissed + 1 }))
      setQueue(prev => prev.filter(t => t.id !== transcriptId))
      if (selectedTranscript?.id === transcriptId) setSelectedTranscript(null)
      router.refresh()
    }
  }, [selectedTranscript, router])

  // --- Batch handlers ---
  const handleBatchDismiss = useCallback(async () => {
    const emailIds: string[] = []
    const transcriptIds: string[] = []

    for (const id of selectedIds) {
      const item = queue.find(q => q.id === id)
      if (!item) continue
      if (item.itemType === 'email') emailIds.push(id)
      else transcriptIds.push(id)
    }

    const promises: Promise<Response>[] = []
    if (emailIds.length > 0) {
      promises.push(fetch('/api/threads/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', threadIds: emailIds }),
      }))
    }
    if (transcriptIds.length > 0) {
      promises.push(fetch('/api/transcripts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', ids: transcriptIds }),
      }))
    }

    await Promise.all(promises)
    const total = emailIds.length + transcriptIds.length
    setSessionStats(prev => ({ ...prev, dismissed: prev.dismissed + total }))
    setQueue(prev => prev.filter(t => !selectedIds.has(t.id)))
    clearSelection()
    toast({ title: `Dismissed ${total} item${total !== 1 ? 's' : ''}` })
    router.refresh()
  }, [selectedIds, queue, clearSelection, toast, router])

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
              ? `Great work! You classified ${sessionStats.classified} and dismissed ${sessionStats.dismissed} items this session.`
              : 'No unclassified items to review.'}
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
              checked={selectedCount === filteredQueue.length && filteredQueue.length > 0}
              onCheckedChange={checked => {
                if (checked) selectAll()
                else clearSelection()
              }}
              className='h-4 w-4'
            />
            <span className='text-muted-foreground text-sm'>
              {selectedCount > 0
                ? `${selectedCount} of ${filteredQueue.length} selected`
                : `${filteredQueue.length} unclassified item${filteredQueue.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          <div className='flex items-center gap-3'>
            {/* Type filter */}
            <Tabs value={typeFilter} onValueChange={v => { setTypeFilter(v as TypeFilter); clearSelection() }}>
              <TabsList className='bg-muted/40 h-8'>
                <TabsTrigger value='all' className='text-xs px-2.5'>
                  All
                  <span className='text-muted-foreground ml-1 text-[10px]'>{queue.length}</span>
                </TabsTrigger>
                <TabsTrigger value='email' className='text-xs px-2.5'>
                  <Mail className='mr-1 h-3 w-3' />
                  Email
                  {emailCount > 0 && <span className='text-muted-foreground ml-1 text-[10px]'>{emailCount}</span>}
                </TabsTrigger>
                <TabsTrigger value='transcript' className='text-xs px-2.5'>
                  <FileText className='mr-1 h-3 w-3' />
                  Transcript
                  {transcriptCount > 0 && <span className='text-muted-foreground ml-1 text-[10px]'>{transcriptCount}</span>}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {totalProcessed > 0 && (
              <span className='text-muted-foreground text-sm'>
                Classified {sessionStats.classified} · Dismissed {sessionStats.dismissed}
              </span>
            )}
          </div>
        </div>

        {/* Item list */}
        <div className='flex-1 divide-y'>
          {filteredQueue.map(item => (
            item.itemType === 'email' ? (
              <EmailTriageRow
                key={item.id}
                thread={item.thread}
                clients={clients}
                projects={projects}
                leads={leads}
                currentUserId={currentUserId}
                isChecked={isSelected(item.id)}
                onToggle={(shiftKey) => toggle(item.id, shiftKey)}
                onAccept={handleAcceptEmail}
                onDismiss={() => handleDismissEmail(item.id)}
                onViewThread={handleViewThread}
              />
            ) : (
              <TranscriptTriageRow
                key={item.id}
                transcript={item.transcript}
                clients={clients}
                projects={projects}
                leads={leads}
                currentUserId={currentUserId}
                isChecked={isSelected(item.id)}
                onToggle={(shiftKey) => toggle(item.id, shiftKey)}
                onAccept={handleAcceptTranscript}
                onDismiss={handleDismissTranscript}
                onViewTranscript={setSelectedTranscript}
              />
            )
          ))}
        </div>

        {/* Load more */}
        {hasMore && (
          <div className='flex items-center justify-center border-t px-4 py-4'>
            <Button
              variant='ghost'
              size='sm'
              onClick={loadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore && <Loader2 className='mr-2 h-3.5 w-3.5 animate-spin' />}
              {isLoadingMore ? 'Loading...' : 'Load more'}
            </Button>
          </div>
        )}

      </section>

      <BatchToolbar
        selectedCount={selectedCount}
        onDismiss={handleBatchDismiss}
        onClear={clearSelection}
      />

      {/* Thread Detail Sheet */}
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
        onClose={handleCloseThreadSheet}
      />

      {/* Transcript Detail Sheet */}
      <TranscriptDetailSheet
        transcript={selectedTranscript}
        clients={clients}
        projects={projects}
        leads={leads}
        currentUserId={currentUserId}
        onClassify={handleAcceptTranscript}
        onDismiss={handleDismissTranscript}
        onUndoDismiss={async (transcriptId) => {
          const res = await fetch(`/api/transcripts/${transcriptId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classification: 'UNCLASSIFIED' }),
          })
          if (res.ok) {
            setSelectedTranscript(prev =>
              prev?.id === transcriptId ? { ...prev, classification: 'UNCLASSIFIED' } : prev
            )
          }
        }}
        onUnlink={async (transcriptId, unlinkData) => {
          const current = selectedTranscript
          const nextClientId = 'clientId' in unlinkData ? null : current?.clientId ?? null
          const nextProjectId = 'projectId' in unlinkData ? null : current?.projectId ?? null
          const nextLeadId = 'leadId' in unlinkData ? null : current?.leadId ?? null
          const allCleared = !nextClientId && !nextProjectId && !nextLeadId

          const res = await fetch(`/api/transcripts/${transcriptId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(allCleared ? { ...unlinkData, classification: 'UNCLASSIFIED' } : unlinkData),
          })
          if (res.ok) {
            setSelectedTranscript(prev => {
              if (prev?.id !== transcriptId) return prev
              return {
                ...prev,
                ...('clientId' in unlinkData ? { clientId: null } : {}),
                ...('projectId' in unlinkData ? { projectId: null } : {}),
                ...('leadId' in unlinkData ? { leadId: null } : {}),
                ...(allCleared ? { classification: 'UNCLASSIFIED' } : {}),
              }
            })
          }
        }}
        onClose={() => setSelectedTranscript(null)}
      />
    </>
  )
}

// =============================================================================
// Email Triage Row
// =============================================================================

function EmailTriageRow({
  thread,
  clients,
  projects,
  leads,
  currentUserId,
  isChecked,
  onToggle,
  onAccept,
  onDismiss,
  onViewThread,
}: {
  thread: TriageEmailThread
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  currentUserId: string
  isChecked: boolean
  onToggle: (shiftKey: boolean) => void
  onAccept: (threadId: string, linkData: { clientId?: string; projectId?: string; leadId?: string }) => Promise<void>
  onDismiss: () => void
  onViewThread: (thread: ThreadSummary) => void
}) {
  const latestMessage = thread.latestMessage

  const handleAnalyze = useCallback(async () => {
    const res = await fetch(`/api/threads/${thread.id}/suggestions`)
    if (!res.ok) throw new Error('Analysis failed')
    const data = await res.json()
    const topClient = data.suggestions?.[0]
    const topProject = data.projectSuggestions?.[0]
    const topLead = data.leadSuggestions?.[0]
    return {
      clientId: topClient?.clientId ?? null,
      clientName: topClient?.clientName ?? null,
      projectId: topProject?.projectId ?? null,
      projectName: topProject?.projectName ?? null,
      leadId: topLead?.leadId ?? null,
      leadName: topLead?.leadName ?? null,
      confidence: Math.max(topClient?.confidence ?? 0, topProject?.confidence ?? 0, topLead?.confidence ?? 0) || null,
    }
  }, [thread.id])

  const handleAccept = useCallback(async (linkData: { clientId?: string; projectId?: string; leadId?: string }) => {
    await onAccept(thread.id, linkData)
  }, [thread.id, onAccept])

  return (
    <div
      role='button'
      tabIndex={0}
      className='flex w-full cursor-pointer items-start gap-3 border-l-[3px] border-l-sky-400/70 px-4 py-3 text-left transition-colors hover:bg-muted/40 dark:border-l-sky-500/50'
      onClick={() => onViewThread(thread)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewThread(thread) } }}
    >
      {/* Checkbox — enlarged click area */}
      <div
        className='-m-3 flex flex-shrink-0 cursor-default items-center justify-center p-3'
        onClick={e => { e.stopPropagation(); onToggle(e.shiftKey) }}
        role='checkbox'
        aria-checked={isChecked}
        tabIndex={-1}
      >
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => {}}
          className='h-4 w-4'
        />
      </div>

      {/* Two-column layout */}
      <div className='flex min-w-0 flex-1 items-start gap-6'>
        {/* LEFT COLUMN: email info */}
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='inline-flex flex-shrink-0 items-center gap-1 rounded-sm bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'>
              <Mail className='h-3 w-3' />
              Email
            </span>
            <span className='truncate text-sm font-semibold tracking-tight'>
              {latestMessage?.fromName || latestMessage?.fromEmail || 'Unknown'}
            </span>
            {thread.messageCount > 1 && (
              <span className='flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded bg-muted px-1 text-[10px] font-medium tabular-nums'>
                {thread.messageCount}
              </span>
            )}
            <span className='text-muted-foreground/50 ml-auto flex-shrink-0 text-[11px] tabular-nums'>
              {thread.lastMessageAt
                ? formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })
                : ''}
            </span>
          </div>
          <p className='text-foreground/90 mt-1 text-[13px] leading-snug'>
            {thread.subject || '(no subject)'}
          </p>
          <p className='text-muted-foreground/70 mt-0.5 line-clamp-2 text-xs leading-relaxed'>
            {latestMessage?.snippet || ''}
          </p>
          <div className='mt-1.5 flex items-center gap-2'>
            {thread.aiSuggestedClientName && (
              <span className='inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400'>
                <Sparkles className='h-2.5 w-2.5' />
                {thread.aiSuggestedClientName}
                {thread.aiSuggestedProjectName && ` → ${thread.aiSuggestedProjectName}`}
              </span>
            )}
            {!thread.aiSuggestedClientName && thread.aiSuggestedLeadName && (
              <span className='inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400'>
                <Sparkles className='h-2.5 w-2.5' />
                {thread.aiSuggestedLeadName}
              </span>
            )}
            {!thread.aiAnalyzedAt && thread.clientSuggestion && (
              <span className='inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400'>
                <Building2 className='h-2.5 w-2.5' />
                {thread.clientSuggestion.clientName}
              </span>
            )}
            {!thread.aiAnalyzedAt && thread.leadSuggestion && !thread.clientSuggestion && (
              <span className='inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400'>
                <UserCircle className='h-2.5 w-2.5' />
                {thread.leadSuggestion.contactName}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: classification controls */}
        <div className='w-72 flex-shrink-0'>
          <ClassifierControls
            clients={clients}
            projects={projects}
            leads={leads}
            currentUserId={currentUserId}
            aiSuggestion={{
              clientId: thread.aiSuggestedClientId,
              clientName: thread.aiSuggestedClientName,
              projectId: thread.aiSuggestedProjectId,
              projectName: thread.aiSuggestedProjectName,
              leadId: thread.aiSuggestedLeadId,
              leadName: thread.aiSuggestedLeadName,
              confidence: thread.aiConfidence,
            }}
            aiAnalyzedAt={thread.aiAnalyzedAt}
            onAnalyze={handleAnalyze}
            onAccept={handleAccept}
            onDismiss={onDismiss}
            dbClientSuggestion={thread.clientSuggestion}
            dbLeadSuggestion={thread.leadSuggestion ? { leadId: thread.leadSuggestion.leadId, contactName: thread.leadSuggestion.contactName } : null}
          />
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Transcript Triage Row
// =============================================================================

function TranscriptTriageRow({
  transcript,
  clients,
  projects,
  leads,
  currentUserId,
  isChecked,
  onToggle,
  onAccept,
  onDismiss,
  onViewTranscript,
}: {
  transcript: TranscriptSummary
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  currentUserId: string
  isChecked: boolean
  onToggle: (shiftKey: boolean) => void
  onAccept: (transcriptId: string, linkData: { clientId?: string; projectId?: string; leadId?: string }) => Promise<void>
  onDismiss: (transcriptId: string) => Promise<void>
  onViewTranscript: (transcript: TranscriptSummary) => void
}) {
  const handleAnalyze = useCallback(async () => {
    const res = await fetch(`/api/transcripts/${transcript.id}/analyze`, { method: 'POST' })
    if (!res.ok) throw new Error('Analysis failed')
    const data = await res.json()
    return data.suggestion ?? null
  }, [transcript.id])

  const handleAccept = useCallback(async (linkData: { clientId?: string; projectId?: string; leadId?: string }) => {
    await onAccept(transcript.id, linkData)
  }, [transcript.id, onAccept])

  const handleDismiss = useCallback(async () => {
    await onDismiss(transcript.id)
  }, [transcript.id, onDismiss])

  return (
    <div
      role='button'
      tabIndex={0}
      className='flex w-full cursor-pointer items-start gap-3 border-l-[3px] border-l-emerald-400/70 px-4 py-3 text-left transition-colors hover:bg-muted/40 dark:border-l-emerald-500/50'
      onClick={() => onViewTranscript(transcript)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewTranscript(transcript) } }}
    >
      {/* Checkbox — enlarged click area */}
      <div
        className='-m-3 flex flex-shrink-0 cursor-default items-center justify-center p-3'
        onClick={e => { e.stopPropagation(); onToggle(e.shiftKey) }}
        role='checkbox'
        aria-checked={isChecked}
        tabIndex={-1}
      >
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => {}}
          className='h-4 w-4'
        />
      </div>

      {/* Two-column layout */}
      <div className='flex min-w-0 flex-1 items-start gap-6'>
        {/* LEFT COLUMN: transcript info */}
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='inline-flex flex-shrink-0 items-center gap-1 rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'>
              <FileText className='h-3 w-3' />
              Transcript
            </span>
            <span className='truncate text-sm font-semibold tracking-tight'>
              {transcript.title}
            </span>
            <span className='text-muted-foreground/50 ml-auto flex-shrink-0 text-[11px] tabular-nums'>
              {transcript.meetingDate
                ? formatDistanceToNow(new Date(transcript.meetingDate), { addSuffix: true })
                : 'Date unknown'}
            </span>
          </div>
          <div className='mt-1.5 flex items-center gap-2'>
            {transcript.aiSuggestedClientName && (
              <span className='inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400'>
                <Sparkles className='h-2.5 w-2.5' />
                {transcript.aiSuggestedClientName}
                {transcript.aiSuggestedProjectName && ` → ${transcript.aiSuggestedProjectName}`}
              </span>
            )}
            {!transcript.aiSuggestedClientName && transcript.aiSuggestedLeadName && (
              <span className='inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400'>
                <Sparkles className='h-2.5 w-2.5' />
                {transcript.aiSuggestedLeadName}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: classification controls */}
        <div className='w-72 flex-shrink-0'>
          <ClassifierControls
            clients={clients}
            projects={projects}
            leads={leads}
            currentUserId={currentUserId}
            aiSuggestion={{
              clientId: transcript.aiSuggestedClientId,
              clientName: transcript.aiSuggestedClientName,
              projectId: transcript.aiSuggestedProjectId,
              projectName: transcript.aiSuggestedProjectName,
              leadId: transcript.aiSuggestedLeadId,
              leadName: transcript.aiSuggestedLeadName,
              confidence: transcript.aiConfidence,
            }}
            aiAnalyzedAt={transcript.aiAnalyzedAt}
            onAnalyze={handleAnalyze}
            onAccept={handleAccept}
            onDismiss={handleDismiss}
          />
        </div>
      </div>
    </div>
  )
}

// Re-export for backward compatibility
export type TriageThread = TriageEmailThread
