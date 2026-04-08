'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Clock,
  Mail,
} from 'lucide-react'
import { PaginationControls } from '@/components/ui/pagination-controls'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import type { ThreadSummary } from '@/lib/types/messages'

import { AttachmentViewer, type AttachmentMetadata } from './attachment-viewer'
import { GmailReconnectBanner } from './gmail-reconnect-banner'
import { ThreadRow } from './thread-row'
import { ComposePanel, type ComposeContext } from './compose-panel'
import { DraftsList } from './drafts-list'
import { InboxSidebar, type InboxView } from './inbox-sidebar'
import { InboxToolbar } from './inbox-toolbar'
import { useInboxSearch } from './hooks/use-inbox-search'
import { useThreadSelection } from './hooks/use-thread-selection'
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
  clientId: string | null
  clientSlug: string | null
  type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
  ownerId: string | null
  createdBy: string | null
}

type Lead = {
  id: string
  contactName: string
}

type ViewType = 'inbox' | 'sent' | 'drafts' | 'scheduled' | 'unclassified' | 'classified' | 'dismissed'

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
  currentUserId: string
  view: ViewType
  searchQuery: string
  sidebarCounts: {
    inbox: number
    unread: number
    drafts: number
    sent: number
    scheduled: number
    unclassified: number
    classified: number
  }
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    pageSize: number
  }
  /** Pre-fetched thread for deep-linking (may not be on current page) */
  initialSelectedThread?: ThreadSummary | null
  /** Active entity filters from URL */
  filterClientId?: string
  filterProjectId?: string
  filterProjectType?: 'CLIENT' | 'INTERNAL' | 'PERSONAL'
  filterLeadId?: string
}

export function InboxPanel({
  threads: initialThreads,
  syncStatus,
  clients,
  projects,
  leads,
  isAdmin,
  currentUserId,
  view,
  searchQuery,
  sidebarCounts,
  pagination,
  initialSelectedThread,
  filterClientId,
  filterProjectId,
  filterProjectType,
  filterLeadId,
}: InboxPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [isFilterPending, startFilterTransition] = useTransition()

  const [threads, setThreads] = useState(initialThreads)

  // Optimistic local filter state — updates instantly, server catches up via transition
  const [localFilters, setLocalFilters] = useState({
    client: filterClientId,
    project: filterProjectId,
    projectType: filterProjectType,
    lead: filterLeadId,
  })

  // Sync local filters when server props arrive (after transition completes)
  useEffect(() => {
    setLocalFilters({
      client: filterClientId,
      project: filterProjectId,
      projectType: filterProjectType,
      lead: filterLeadId,
    })
  }, [filterClientId, filterProjectId, filterProjectType, filterLeadId])

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

  // Attachment viewer state
  const [viewingAttachment, setViewingAttachment] = useState<{
    attachment: AttachmentMetadata
    externalMessageId: string
  } | null>(null)

  // Compose panel state (for replies within thread detail)
  const [composeContext, setComposeContext] = useState<ComposeContext | null>(null)

  // Standalone compose sheet state (for new emails)
  const [isComposeOpen, setIsComposeOpen] = useState(false)

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
        router.push('/my/communications/emails')
      } else {
        router.push(`/my/communications/emails/${newView}`)
      }
    },
    [router]
  )

  // Handle filter changes — optimistic local update + server navigation in transition
  const handleFilterChange = useCallback(
    (key: 'client' | 'project' | 'projectType' | 'lead', value: string | undefined) => {
      // Optimistic: update local state immediately
      setLocalFilters(prev => {
        const next = { ...prev, [key]: value }
        // Clear project/projectType when client changes
        if (key === 'client') {
          next.project = undefined
          next.projectType = undefined
        }
        // Clear projectType when specific project selected, and vice versa
        if (key === 'project') next.projectType = undefined
        if (key === 'projectType') next.project = undefined
        return next
      })

      // Build URL and navigate in transition (non-blocking)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('thread')
      params.delete('page')
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      if (key === 'client') {
        params.delete('project')
        params.delete('projectType')
      }
      if (key === 'project') params.delete('projectType')
      if (key === 'projectType') params.delete('project')
      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname
      startFilterTransition(() => {
        router.push(newUrl)
      })
    },
    [router, searchParams, pathname, startFilterTransition]
  )

  // Clear all entity filters at once
  const handleClearFilters = useCallback(() => {
    setLocalFilters({ client: undefined, project: undefined, projectType: undefined, lead: undefined })
    const params = new URLSearchParams(searchParams.toString())
    params.delete('thread')
    params.delete('page')
    params.delete('client')
    params.delete('project')
    params.delete('projectType')
    params.delete('lead')
    const newUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname
    startFilterTransition(() => {
      router.push(newUrl)
    })
  }, [router, searchParams, pathname, startFilterTransition])

  // Wrapper that clears local state when closing the sheet
  const onCloseSheet = useCallback(() => {
    setViewingAttachment(null)
    setComposeContext(null)
    handleCloseSheet()
  }, [handleCloseSheet])

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
    if (canGoPrev) handleThreadClick(threads[currentIndex - 1])
  }

  const goToNext = () => {
    if (canGoNext) handleThreadClick(threads[currentIndex + 1])
  }

  return (
    <>
      <div className='space-y-4'>
        {/* Main Card */}
        <section className='bg-background flex min-h-[calc(100vh-13rem)] min-w-0 flex-col overflow-hidden rounded-xl border shadow-sm'>
          {/* Toolbar — spans full width above sidebar + content */}
          <div className='border-b px-6 py-4'>
            {/* Reconnect Banner - shown when connection needs reauth */}
            {syncStatus.connectionStatus &&
              syncStatus.connectionStatus !== 'ACTIVE' && (
                <div className='mb-4'>
                  <GmailReconnectBanner
                    status={syncStatus.connectionStatus}
                    errorMessage={syncStatus.connectionError}
                  />
                </div>
              )}

            <InboxToolbar
              currentView={currentView}
              onViewChange={handleMobileViewChange}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              isSearching={isSearching}
              onClearSearch={handleClearSearch}
              isConnected={syncStatus.connected}
              unclassifiedCount={sidebarCounts.unclassified}
              clients={clients}
              projects={projects}
              leads={leads}
              filterClientId={localFilters.client}
              filterProjectId={localFilters.project}
              filterProjectType={localFilters.projectType}
              filterLeadId={localFilters.lead}
              currentUserId={currentUserId}
              isFilterPending={isFilterPending}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />
          </div>

          <div className='flex min-w-0 flex-1'>
            {/* Left Sidebar */}
            <aside className='hidden w-56 flex-shrink-0 border-r py-6 md:block'>
              <InboxSidebar
                currentView={currentView}
                counts={sidebarCounts}
                preservedParams={{
                  thread: searchParams.get('thread'),
                  q: searchParams.get('q'),
                  client: searchParams.get('client'),
                  project: searchParams.get('project'),
                  projectType: searchParams.get('projectType'),
                  lead: searchParams.get('lead'),
                }}
              />
            </aside>

            {/* Main Content */}
            <div className='flex min-w-0 flex-1 flex-col p-6'>
              <div className='flex min-w-0 flex-1 flex-col space-y-4'>

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
                          onClick={() => handleThreadClick(thread)}
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
        currentUserId={currentUserId}
        clients={clients}
        projects={projects}
        leads={leads}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onPrev={goToPrev}
        onNext={goToNext}
        composeContext={composeContext}
        setComposeContext={setComposeContext}
        onRefreshMessages={refreshMessages}
        setThreadMessages={setThreadMessages}
        setThreads={setThreads}
        setSelectedThread={setSelectedThread}
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
              // Refresh to pick up the sent message
              router.refresh()
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

