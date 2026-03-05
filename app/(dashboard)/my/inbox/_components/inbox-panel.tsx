'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  Clock,
  Mail,
  RefreshCw,
} from 'lucide-react'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { PaginationControls } from '@/components/ui/pagination-controls'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { ThreadSummary, Message } from '@/lib/types/messages'

import { AttachmentViewer, type AttachmentMetadata } from './attachment-viewer'
import { GmailReconnectBanner } from './gmail-reconnect-banner'
import { ThreadRow } from './thread-row'
import { ComposePanel, type ComposeContext } from './compose-panel'
import { DraftsList } from './drafts-list'
import { InboxSidebar, type InboxView } from './inbox-sidebar'
import { InboxToolbar } from './inbox-toolbar'
import { useInboxSearch } from './hooks/use-inbox-search'
import { useThreadSelection } from './hooks/use-thread-selection'
import { useThreadSuggestions } from './hooks/use-thread-suggestions'
import { useThreadLinking } from './hooks/use-thread-linking'
import { ThreadDetailSheet } from './thread-detail-sheet'

type Client = {
  id: string
  name: string
  slug: string | null
}

type Project = {
  id: string
  name: string
  slug: string | null
  clientSlug: string | null
}

type Lead = {
  id: string
  contactName: string
}

type ViewType = 'inbox' | 'sent' | 'drafts' | 'scheduled' | 'linked' | 'unlinked'

type ConnectionStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING_REAUTH'

type InboxPanelProps = {
  threads: ThreadSummary[]
  syncStatus: {
    connected: boolean
    lastSyncAt: string | null
    totalMessages: number
    unread: number
    connectionStatus: ConnectionStatus | null
    connectionError: string | null
  }
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  isAdmin: boolean
  view: ViewType
  searchQuery: string
  sidebarCounts: {
    inbox: number
    unread: number
    drafts: number
    sent: number
    scheduled: number
    linked: number
    unlinked: number
  }
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    pageSize: number
  }
  /** Pre-fetched thread for deep-linking (may not be on current page) */
  initialSelectedThread?: ThreadSummary | null
}

export function InboxPanel({
  threads: initialThreads,
  syncStatus,
  clients,
  projects,
  leads,
  isAdmin,
  view,
  searchQuery,
  sidebarCounts,
  pagination,
  initialSelectedThread,
}: InboxPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { toast } = useToast()

  const [threads, setThreads] = useState(initialThreads)

  // Current sidebar view - derived directly from URL via view prop
  const currentView: InboxView = view as InboxView

  // Sync threads state when props change (e.g., on pagination/filter change)
  useEffect(() => {
    setThreads(initialThreads)
  }, [initialThreads])

  // Thread selection hook - manages selected thread, messages, and URL sync
  const {
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
  } = useThreadSelection({
    threads,
    initialSelectedThread,
    searchParams,
    pathname,
    router,
    setThreads,
  })

  // Search hook - manages search input, debouncing, and URL sync
  const {
    searchInput,
    setSearchInput,
    isSearching,
    handleClearSearch,
  } = useInboxSearch({
    searchQuery,
    searchParams,
    pathname,
    router,
  })

  const [isSyncing, setIsSyncing] = useState(false)

  // Attachment viewer state
  const [viewingAttachment, setViewingAttachment] = useState<{
    attachment: AttachmentMetadata
    externalMessageId: string
  } | null>(null)

  // AI Task Suggestions state (auto-triggered when both client + project linked)
  const [isAnalyzingThread, setIsAnalyzingThread] = useState(false)
  const [suggestionRefreshKey, setSuggestionRefreshKey] = useState(0)

  // Compose panel state (for replies within thread detail)
  const [composeContext, setComposeContext] = useState<ComposeContext | null>(null)

  // Standalone compose sheet state (for new emails)
  const [isComposeOpen, setIsComposeOpen] = useState(false)

  /**
   * Trigger AI analysis for a thread when both client and project are linked.
   * This allows automatic task suggestion generation without manual intervention.
   */
  const triggerThreadAnalysis = useCallback(
    async (threadId: string) => {
      setIsAnalyzingThread(true)
      try {
        const res = await fetch(`/api/threads/${threadId}/analyze`, {
          method: 'POST',
        })
        if (res.ok) {
          // Increment refresh key to trigger re-fetch in ThreadSuggestionsPanel
          setSuggestionRefreshKey(prev => prev + 1)
        } else {
          // Log non-ok responses for debugging (e.g., 400, 403, 500)
          const errorData = await res.json().catch(() => ({}))
          console.error('Thread analysis returned error:', {
            status: res.status,
            threadId,
            error: errorData.error || res.statusText,
          })
        }
      } catch (err) {
        console.error('Failed to analyze thread:', err)
      } finally {
        setIsAnalyzingThread(false)
      }
    },
    []
  )

  // Suggestions hook - manages client and project suggestions
  const {
    suggestions,
    suggestionsLoading,
    projectSuggestions,
    projectSuggestionsLoading,
    clearSuggestions,
    clearProjectSuggestions,
  } = useThreadSuggestions({
    selectedThread,
  })

  // Linking hook - manages client, project, and lead linking
  const {
    isLinking,
    isLinkingProject,
    isLinkingLead,
    handleLinkClient,
    handleUnlinkClient,
    handleLinkProject,
    handleUnlinkProject,
    handleLinkLead,
    handleUnlinkLead,
  } = useThreadLinking({
    selectedThread,
    setSelectedThread,
    setThreads,
    clients,
    projects,
    leads,
    onClientLinked: clearSuggestions,
    onProjectLinked: clearProjectSuggestions,
    toast,
  })

  // Handler for resuming a draft
  const handleResumeDraft = useCallback((draftContext: ComposeContext) => {
    setComposeContext(draftContext)
    setIsComposeOpen(true)
  }, [])

  // Handle page changes - triggers server-side navigation
  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString())
      // Remove thread param when changing pages
      params.delete('thread')
      if (page === 1) {
        params.delete('page')
      } else {
        params.set('page', String(page))
      }
      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname
      router.push(newUrl)
    },
    [router, searchParams, pathname]
  )

  // Handle mobile view changes - triggers server-side navigation
  const handleMobileViewChange = useCallback(
    (newView: string) => {
      if (newView === 'inbox') {
        router.push('/my/inbox/emails')
      } else {
        router.push(`/my/inbox/emails/${newView}`)
      }
    },
    [router]
  )

  const handleSync = async (silent = false) => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/integrations/gmail/sync', {
        method: 'POST',
      })
      if (res.ok) {
        if (!silent) {
          toast({
            title: 'Sync complete',
            description: 'Emails synced successfully.',
          })
        }
        router.refresh()
      }
    } catch {
      if (!silent) {
        toast({ title: 'Sync failed', variant: 'destructive' })
      }
    } finally {
      setIsSyncing(false)
    }
  }

  // Auto-sync on page load and poll every 60s while connected
  const hasSyncedRef = useRef(false)
  useEffect(() => {
    if (!syncStatus.connected) return

    // Initial sync on mount
    if (!hasSyncedRef.current) {
      hasSyncedRef.current = true
      handleSync(true)
    }

    const interval = setInterval(() => {
      handleSync(true)
    }, 60_000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus.connected])

  // Wrapper that clears suggestions when selecting a new thread
  const onThreadClick = useCallback(
    async (thread: ThreadSummary, updateUrl = true) => {
      clearSuggestions()
      clearProjectSuggestions()
      await handleThreadClick(thread, updateUrl)
    },
    [handleThreadClick, clearSuggestions, clearProjectSuggestions]
  )

  // Wrapper that clears local state when closing the sheet
  const onCloseSheet = useCallback(() => {
    setViewingAttachment(null)
    clearSuggestions()
    clearProjectSuggestions()
    setComposeContext(null)
    handleCloseSheet()
  }, [handleCloseSheet, clearSuggestions, clearProjectSuggestions])

  const handleReply = useCallback(
    (message: Message, mode: 'reply' | 'reply_all' | 'forward') => {
      if (!selectedThread) return

      // Build recipient list based on mode
      let toEmails: string[] = []
      let ccEmails: string[] = []

      if (mode === 'reply') {
        // Reply to sender only
        toEmails = message.fromEmail ? [message.fromEmail] : []
      } else if (mode === 'reply_all') {
        // Reply to sender + all recipients (excluding self)
        toEmails = message.fromEmail ? [message.fromEmail] : []
        const allRecipients = [
          ...(message.toEmails || []),
          ...(message.ccEmails || []),
        ]
        ccEmails = allRecipients.filter(
          email => email !== message.fromEmail && !toEmails.includes(email)
        )
      }
      // Forward mode: leave recipients empty for user to fill

      // Build subject
      let subject = message.subject || selectedThread.subject || ''
      if (mode === 'forward') {
        if (!subject.toLowerCase().startsWith('fwd:')) {
          subject = `Fwd: ${subject}`
        }
      } else {
        if (!subject.toLowerCase().startsWith('re:')) {
          subject = `Re: ${subject}`
        }
      }

      // Build quoted body
      const quotedBody = message.bodyText || message.snippet || ''

      setComposeContext({
        mode,
        threadId: selectedThread.id,
        inReplyToMessageId: message.externalMessageId || undefined,
        to: toEmails,
        cc: ccEmails,
        subject,
        quotedBody,
        clientId: selectedThread.client?.id,
        projectId: selectedThread.project?.id,
      })
    },
    [selectedThread]
  )

  // Auto-scroll to inline compose when it opens
  useEffect(() => {
    if (composeContext && selectedThread) {
      // Use setTimeout to allow React to render the compose panel first
      setTimeout(() => {
        const composeEl = document.getElementById('inline-compose')
        if (composeEl) {
          composeEl.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }
      }, 100)
    }
  }, [composeContext, selectedThread])

  // Navigate between threads (within current page)
  const currentIndex = selectedThread
    ? threads.findIndex(t => t.id === selectedThread.id)
    : -1
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < threads.length - 1

  const goToPrev = () => {
    if (canGoPrev) onThreadClick(threads[currentIndex - 1])
  }

  const goToNext = () => {
    if (canGoNext) onThreadClick(threads[currentIndex + 1])
  }

  return (
    <>
      <AppShellHeader>
        <h1 className='text-2xl font-semibold tracking-tight'>Inbox</h1>
        <p className='text-muted-foreground text-sm'>
          View and manage synced communications.
        </p>
      </AppShellHeader>

      <div className='space-y-4'>
        {/* Tabs Row */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <Tabs value='emails' className='w-full sm:w-auto'>
            <TabsList className='bg-muted/40 h-10 w-full justify-start gap-2 rounded-lg p-1 sm:w-auto'>
              <TabsTrigger value='emails' className='px-3 py-1.5 text-sm'>
                Emails
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {syncStatus.connected && (
            <div className='flex items-center gap-4'>
              {syncStatus.lastSyncAt && (
                <span className='text-muted-foreground text-sm whitespace-nowrap'>
                  Last sync{' '}
                  {formatDistanceToNow(new Date(syncStatus.lastSyncAt))} ago
                </span>
              )}
              <Button
                variant='outline'
                size='sm'
                onClick={() => handleSync()}
                disabled={isSyncing}
              >
                <RefreshCw
                  className={cn('h-4 w-4', isSyncing && 'animate-spin')}
                />
                {isSyncing ? 'Syncing...' : 'Sync'}
              </Button>
            </div>
          )}
        </div>

        {/* Main Card */}
        <section className='bg-background flex min-h-[calc(100vh-13rem)] flex-col overflow-hidden rounded-xl border shadow-sm'>
          <div className='flex flex-1'>
            {/* Left Sidebar */}
            <aside className='hidden w-56 flex-shrink-0 border-r py-6 md:block'>
              <InboxSidebar
                currentView={currentView}
                counts={sidebarCounts}
                preservedParams={{
                  thread: searchParams.get('thread'),
                  q: searchParams.get('q'),
                }}
              />
            </aside>

            {/* Main Content */}
            <div className='flex min-w-0 flex-1 flex-col p-6'>
              <div className='flex flex-1 flex-col space-y-4'>
                {/* Reconnect Banner - shown when connection needs reauth */}
                {syncStatus.connectionStatus &&
                  syncStatus.connectionStatus !== 'ACTIVE' && (
                    <GmailReconnectBanner
                      status={syncStatus.connectionStatus}
                      errorMessage={syncStatus.connectionError}
                    />
                  )}

                {/* Header Row */}
                <InboxToolbar
                  currentView={currentView}
                  onViewChange={handleMobileViewChange}
                  searchInput={searchInput}
                  onSearchInputChange={setSearchInput}
                  isSearching={isSearching}
                  onClearSearch={handleClearSearch}
                  isConnected={syncStatus.connected}
                  onCompose={() => setIsComposeOpen(true)}
                />

                {/* Thread List or Drafts View */}
                {currentView === 'drafts' ? (
                  <DraftsList onResumeDraft={handleResumeDraft} />
                ) : currentView === 'scheduled' ? (
                  <div className='flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center'>
                    <Clock className='text-muted-foreground mb-4 h-12 w-12' />
                    <h3 className='text-lg font-medium'>
                      {sidebarCounts.scheduled > 0
                        ? `${sidebarCounts.scheduled} Scheduled Email${sidebarCounts.scheduled > 1 ? 's' : ''}`
                        : 'No scheduled emails'}
                    </h3>
                    <p className='text-muted-foreground mt-1 text-sm'>
                      {sidebarCounts.scheduled > 0
                        ? 'Your scheduled emails will be sent automatically.'
                        : 'Emails you schedule will appear here.'}
                    </p>
                  </div>
                ) : threads.length === 0 ? (
                  <div className='flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center'>
                    <Mail className='text-muted-foreground mb-4 h-12 w-12' />
                    <h3 className='text-lg font-medium'>No threads found</h3>
                    <p className='text-muted-foreground mt-1 text-sm'>
                      {!syncStatus.connected
                        ? 'Connect Gmail in Settings → Integrations to get started'
                        : currentView !== 'inbox'
                          ? `No ${currentView} threads found.`
                          : isSyncing
                            ? 'Syncing your emails...'
                            : 'No emails synced yet.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className='overflow-hidden rounded-lg border'>
                      {threads.map((thread, idx) => (
                        <ThreadRow
                          key={thread.id}
                          thread={thread}
                          isSelected={selectedThread?.id === thread.id}
                          isFirst={idx === 0}
                          onClick={() => onThreadClick(thread)}
                        />
                      ))}
                    </div>

                    {/* Bottom Pagination */}
                    <PaginationControls
                      mode='paged'
                      currentPage={pagination.currentPage}
                      totalPages={pagination.totalPages}
                      totalItems={pagination.totalItems}
                      pageSize={pagination.pageSize}
                      onPageChange={handlePageChange}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Thread Detail Sheet */}
      <ThreadDetailSheet
        selectedThread={selectedThread}
        threadMessages={threadMessages}
        cidMappings={cidMappings}
        attachmentsMap={attachmentsMap}
        isLoadingMessages={isLoadingMessages}
        isAdmin={isAdmin}
        clients={clients}
        projects={projects}
        leads={leads}
        suggestions={suggestions}
        projectSuggestions={projectSuggestions}
        suggestionsLoading={suggestionsLoading}
        projectSuggestionsLoading={projectSuggestionsLoading}
        isAnalyzingThread={isAnalyzingThread}
        suggestionRefreshKey={suggestionRefreshKey}
        isLinking={isLinking}
        isLinkingProject={isLinkingProject}
        isLinkingLead={isLinkingLead}
        onLinkClient={handleLinkClient}
        onUnlinkClient={handleUnlinkClient}
        onLinkProject={handleLinkProject}
        onUnlinkProject={handleUnlinkProject}
        onLinkLead={handleLinkLead}
        onUnlinkLead={handleUnlinkLead}
        onRefreshSuggestions={() => triggerThreadAnalysis(selectedThread?.id || '')}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onPrev={goToPrev}
        onNext={goToNext}
        composeContext={composeContext}
        setComposeContext={setComposeContext}
        onReply={handleReply}
        onRefreshMessages={refreshMessages}
        setThreadMessages={setThreadMessages}
        setThreads={setThreads}
        setViewingAttachment={setViewingAttachment}
        onClose={onCloseSheet}
      />

      {/* Standalone Compose Sheet (for new emails and resumed drafts) */}
      <Sheet
        open={isComposeOpen}
        onOpenChange={open => {
          setIsComposeOpen(open)
          if (!open) setComposeContext(null)
        }}
      >
        <SheetContent className='flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg'>
          <SheetTitle className='sr-only'>
            {composeContext?.draftId ? 'Edit Draft' : 'Compose New Email'}
          </SheetTitle>
          <SheetDescription className='sr-only'>
            {composeContext?.draftId
              ? 'Continue editing your draft'
              : 'Write and send a new email'}
          </SheetDescription>
          <ComposePanel
            context={composeContext || { mode: 'new' }}
            onClose={() => {
              setIsComposeOpen(false)
              setComposeContext(null)
            }}
            onSent={() => {
              setIsComposeOpen(false)
              setComposeContext(null)
              // Trigger a sync to fetch the sent message
              handleSync(true)
            }}
            hideCloseButton
          />
        </SheetContent>
      </Sheet>

      {/* Attachment Viewer */}
      <AttachmentViewer
        attachment={viewingAttachment?.attachment ?? null}
        externalMessageId={viewingAttachment?.externalMessageId ?? null}
        onClose={() => setViewingAttachment(null)}
      />
    </>
  )
}

