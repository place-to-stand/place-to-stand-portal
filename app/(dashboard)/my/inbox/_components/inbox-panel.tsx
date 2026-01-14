'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Mail,
  RefreshCw,
  CheckCircle,
  Circle,
  Filter,
  PenSquare,
  FileEdit,
  Clock,
  FolderKanban,
} from 'lucide-react'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PaginationControls } from '@/components/ui/pagination-controls'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { ThreadSummary, Message } from '@/lib/types/messages'
import type { CidMapping } from '@/lib/email/sanitize'

import { EmailToolbar } from './email-toolbar'
import { MessageCard } from './message-card'
import { ThreadContactPanel } from './thread-contact-panel'
import { ThreadLinkingPanel } from './thread-linking-panel'
import { ThreadProjectLinkingPanel } from './thread-project-linking-panel'
import { ThreadRow } from './thread-row'
import { ThreadSuggestionsPanel } from './thread-suggestions-panel'
import { ComposePanel, type ComposeContext } from './compose-panel'
import { DraftsList } from './drafts-list'
import { InboxSidebar, type InboxView } from './inbox-sidebar'

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

type Suggestion = {
  clientId: string
  clientName: string
  confidence: number
  matchedContacts: string[]
  reasoning?: string
  matchType?: 'EXACT_EMAIL' | 'DOMAIN' | 'CONTENT' | 'CONTEXTUAL'
}

type ProjectSuggestion = {
  projectId: string
  projectName: string
  confidence: number
  reasoning?: string
  matchType?: 'NAME' | 'CONTENT' | 'CONTEXTUAL'
}

type FilterType = 'all' | 'linked' | 'unlinked' | 'sent'

type InboxPanelProps = {
  threads: ThreadSummary[]
  syncStatus: {
    connected: boolean
    lastSyncAt: string | null
    totalMessages: number
    unread: number
  }
  clients: Client[]
  projects: Project[]
  isAdmin: boolean
  filter: FilterType
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
  isAdmin,
  filter,
  sidebarCounts,
  pagination,
  initialSelectedThread,
}: InboxPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [threads, setThreads] = useState(initialThreads)

  // Current sidebar view
  const [currentView, setCurrentView] = useState<InboxView>(() => {
    // Initialize from filter param
    if (filter === 'linked') return 'linked'
    if (filter === 'unlinked') return 'unlinked'
    if (filter === 'sent') return 'sent'
    return 'inbox'
  })

  // Sync threads state when props change (e.g., on pagination/filter change)
  useEffect(() => {
    setThreads(initialThreads)
  }, [initialThreads])
  const [isSyncing, setIsSyncing] = useState(false)
  const [selectedThread, setSelectedThread] = useState<ThreadSummary | null>(
    null
  )
  const [threadMessages, setThreadMessages] = useState<Message[]>([])
  const [cidMappings, setCidMappings] = useState<Record<string, CidMapping[]>>(
    {}
  )
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLinking, setIsLinking] = useState(false)

  // AI Suggestions state (for client matching)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  // AI Suggestions state (for project matching)
  const [projectSuggestions, setProjectSuggestions] = useState<
    ProjectSuggestion[]
  >([])
  const [projectSuggestionsLoading, setProjectSuggestionsLoading] =
    useState(false)
  const [isLinkingProject, setIsLinkingProject] = useState(false)

  // AI Task Suggestions state (auto-triggered when both client + project linked)
  const [isAnalyzingThread, setIsAnalyzingThread] = useState(false)
  const [suggestionRefreshKey, setSuggestionRefreshKey] = useState(0)

  // Compose panel state (for replies within thread detail)
  const [composeContext, setComposeContext] = useState<ComposeContext | null>(null)

  // Standalone compose sheet state (for new emails)
  const [isComposeOpen, setIsComposeOpen] = useState(false)

  // Drafts popover state
  const [isDraftsOpen, setIsDraftsOpen] = useState(false)

  // Handler for resuming a draft
  const handleResumeDraft = useCallback((draftContext: ComposeContext) => {
    setIsDraftsOpen(false)
    setComposeContext(draftContext)
    setIsComposeOpen(true)
  }, [])

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
        ? `/my/inbox?${params.toString()}`
        : '/my/inbox'
      router.push(newUrl)
    },
    [router, searchParams]
  )

  // Handle filter changes - triggers server-side navigation
  const handleFilterChange = useCallback(
    (newFilter: FilterType) => {
      const params = new URLSearchParams(searchParams.toString())
      // Reset to page 1 and remove thread when changing filter
      params.delete('thread')
      params.delete('page')
      if (newFilter === 'all') {
        params.delete('filter')
      } else {
        params.set('filter', newFilter)
      }
      const newUrl = params.toString()
        ? `/my/inbox?${params.toString()}`
        : '/my/inbox'
      router.push(newUrl)
    },
    [router, searchParams]
  )

  // Handle sidebar view changes
  const handleViewChange = useCallback(
    (view: InboxView) => {
      setCurrentView(view)
      // Map views to filter params for server-side navigation
      if (view === 'inbox') {
        handleFilterChange('all')
      } else if (view === 'linked') {
        handleFilterChange('linked')
      } else if (view === 'unlinked') {
        handleFilterChange('unlinked')
      } else if (view === 'sent') {
        handleFilterChange('sent')
      } else if (view === 'drafts') {
        // For now, drafts uses client-side state - stays on current page
        // Could navigate to a dedicated drafts route in the future
      } else if (view === 'scheduled') {
        // Scheduled emails - client-side for now
      }
      // by-client and by-project would need their own routes
    },
    [handleFilterChange]
  )

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

  // Auto-sync on page load when Gmail is connected
  // Use a ref to ensure this only runs once per session
  const hasSyncedRef = useRef(false)
  useEffect(() => {
    if (syncStatus.connected && !hasSyncedRef.current) {
      hasSyncedRef.current = true
      handleSync(true) // Silent sync
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleThreadClick = useCallback(
    async (thread: ThreadSummary, updateUrl = true) => {
      setSelectedThread(thread)
      setIsLoadingMessages(true)
      setThreadMessages([])
      setCidMappings({})
      setSuggestions([])
      setProjectSuggestions([])

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
    [router, searchParams]
  )

  // Load AI suggestions when thread changes and has no client
  useEffect(() => {
    if (!selectedThread || selectedThread.client) {
      setSuggestions([])
      return
    }

    setSuggestionsLoading(true)
    fetch(`/api/threads/${selectedThread.id}/suggestions`)
      .then(r => {
        if (!r.ok) throw new Error(`Suggestions fetch failed: ${r.status}`)
        return r.json()
      })
      .then(data => setSuggestions(data.suggestions || []))
      .catch(err => {
        console.error('Failed to load client suggestions:', err)
        setSuggestions([])
      })
      .finally(() => setSuggestionsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id, selectedThread?.client])

  // Load project suggestions when thread changes and has no project
  useEffect(() => {
    if (!selectedThread || selectedThread.project) {
      setProjectSuggestions([])
      return
    }

    setProjectSuggestionsLoading(true)
    fetch(`/api/threads/${selectedThread.id}/project-suggestions`)
      .then(r => {
        if (!r.ok) throw new Error(`Project suggestions fetch failed: ${r.status}`)
        return r.json()
      })
      .then(data => setProjectSuggestions(data.suggestions || []))
      .catch(err => {
        console.error('Failed to load project suggestions:', err)
        setProjectSuggestions([])
      })
      .finally(() => setProjectSuggestionsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id, selectedThread?.project])

  const handleCloseSheet = useCallback(() => {
    setSelectedThread(null)
    setThreadMessages([])
    setCidMappings({})
    setSuggestions([])
    setProjectSuggestions([])
    setComposeContext(null)

    // Remove thread from URL
    const params = new URLSearchParams(searchParams.toString())
    params.delete('thread')
    const newUrl = params.toString()
      ? `/my/inbox?${params.toString()}`
      : '/my/inbox'
    router.push(newUrl, { scroll: false })
  }, [router, searchParams])

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

  const handleLinkClient = async (clientId: string) => {
    if (!selectedThread) return

    setIsLinking(true)
    try {
      const res = await fetch(`/api/threads/${selectedThread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })

      if (res.ok) {
        const client = clients.find(c => c.id === clientId)

        // Update local state
        const updatedThread: ThreadSummary = {
          ...selectedThread,
          client: client
            ? { id: client.id, name: client.name, slug: client.slug }
            : null,
        }
        setSelectedThread(updatedThread)
        setThreads(prev =>
          prev.map(t => (t.id === selectedThread.id ? updatedThread : t))
        )
        setSuggestions([]) // Clear suggestions after linking

        toast({ title: 'Thread linked to client' })

        // Auto-trigger analysis if both client and project are now linked
        if (updatedThread.project) {
          triggerThreadAnalysis(selectedThread.id)
        }
      } else {
        throw new Error('Failed to link')
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to link thread.',
        variant: 'destructive',
      })
    } finally {
      setIsLinking(false)
    }
  }

  const handleUnlinkClient = async () => {
    if (!selectedThread) return

    setIsLinking(true)
    try {
      const res = await fetch(`/api/threads/${selectedThread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: null }),
      })

      if (res.ok) {
        const updatedThread: ThreadSummary = {
          ...selectedThread,
          client: null,
        }
        setSelectedThread(updatedThread)
        setThreads(prev =>
          prev.map(t => (t.id === selectedThread.id ? updatedThread : t))
        )

        toast({ title: 'Client unlinked' })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unlink.',
        variant: 'destructive',
      })
    } finally {
      setIsLinking(false)
    }
  }

  const handleLinkProject = async (projectId: string) => {
    if (!selectedThread) return

    setIsLinkingProject(true)
    try {
      const res = await fetch(`/api/threads/${selectedThread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (res.ok) {
        const project = projects.find(p => p.id === projectId)

        // Update local state
        const updatedThread: ThreadSummary = {
          ...selectedThread,
          project: project
            ? {
                id: project.id,
                name: project.name,
                slug: project.slug,
                clientSlug: project.clientSlug,
              }
            : null,
        }
        setSelectedThread(updatedThread)
        setThreads(prev =>
          prev.map(t => (t.id === selectedThread.id ? updatedThread : t))
        )
        setProjectSuggestions([]) // Clear suggestions after linking

        toast({ title: 'Thread linked to project' })

        // Auto-trigger analysis if both client and project are now linked
        if (updatedThread.client) {
          triggerThreadAnalysis(selectedThread.id)
        }
      } else {
        throw new Error('Failed to link')
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to link thread to project.',
        variant: 'destructive',
      })
    } finally {
      setIsLinkingProject(false)
    }
  }

  const handleUnlinkProject = async () => {
    if (!selectedThread) return

    setIsLinkingProject(true)
    try {
      const res = await fetch(`/api/threads/${selectedThread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: null }),
      })

      if (res.ok) {
        const updatedThread: ThreadSummary = {
          ...selectedThread,
          project: null,
        }
        setSelectedThread(updatedThread)
        setThreads(prev =>
          prev.map(t => (t.id === selectedThread.id ? updatedThread : t))
        )

        toast({ title: 'Project unlinked' })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unlink project.',
        variant: 'destructive',
      })
    } finally {
      setIsLinkingProject(false)
    }
  }

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
      <AppShellHeader>
        <h1 className='text-2xl font-semibold tracking-tight'>Inbox</h1>
        <p className='text-muted-foreground text-sm'>
          View and manage synced communications.
        </p>
      </AppShellHeader>

      {/* Two-column layout with sidebar */}
      <div className='flex gap-6'>
        {/* Left Sidebar */}
        <aside className='bg-background hidden w-56 flex-shrink-0 rounded-xl border shadow-sm md:block'>
          <div className='p-2'>
            {/* Compose button at top of sidebar */}
            {syncStatus.connected && (
              <Button
                className='mb-2 w-full'
                onClick={() => setIsComposeOpen(true)}
              >
                <PenSquare className='mr-2 h-4 w-4' />
                Compose
              </Button>
            )}
          </div>
          <InboxSidebar
            currentView={currentView}
            onViewChange={handleViewChange}
            counts={sidebarCounts}
          />
        </aside>

        {/* Main Content */}
        <section className='bg-background min-w-0 flex-1 rounded-xl border p-6 shadow-sm'>
          <div className='space-y-4'>
            {/* Header Row */}
            <div className='flex flex-wrap items-center gap-4'>
              {/* Mobile-only filter dropdown */}
              <Select
                value={filter}
                onValueChange={v => handleFilterChange(v as FilterType)}
              >
                <SelectTrigger className='w-40 md:hidden'>
                  <span className='flex items-center'>
                    <Filter className='mr-2 h-4 w-4' />
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Threads</SelectItem>
                  <SelectItem value='linked'>Linked</SelectItem>
                  <SelectItem value='unlinked'>Unlinked</SelectItem>
                </SelectContent>
              </Select>

              <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                {syncStatus.connected ? (
                  <CheckCircle className='h-4 w-4 text-green-500' />
                ) : (
                  <Circle className='h-4 w-4' />
                )}
                <span>{pagination.totalItems} threads</span>
                {syncStatus.unread > 0 && (
                  <Badge variant='secondary' className='text-xs'>
                    {syncStatus.unread} unread
                  </Badge>
                )}
              </div>

              <div className='ml-auto flex items-center gap-4'>
                {syncStatus.lastSyncAt && (
                  <span className='text-muted-foreground text-xs'>
                    Last sync{' '}
                    {formatDistanceToNow(new Date(syncStatus.lastSyncAt))} ago
                  </span>
                )}
                {syncStatus.connected && (
                  <>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => handleSync()}
                      disabled={isSyncing}
                    >
                      <RefreshCw
                        className={cn('mr-2 h-4 w-4', isSyncing && 'animate-spin')}
                      />
                      {isSyncing ? 'Syncing...' : 'Sync'}
                    </Button>
                    {/* Mobile-only compose button */}
                    <Button
                      size='sm'
                      className='md:hidden'
                      onClick={() => setIsComposeOpen(true)}
                    >
                      <PenSquare className='mr-2 h-4 w-4' />
                      Compose
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Thread List or Drafts View */}
            {currentView === 'drafts' ? (
              <div className='rounded-lg border p-4'>
                <h3 className='mb-4 font-medium'>Drafts</h3>
                <DraftsList onResumeDraft={handleResumeDraft} />
              </div>
            ) : currentView === 'scheduled' ? (
              <div className='flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center'>
                <Clock className='text-muted-foreground mb-4 h-12 w-12' />
                <h3 className='text-lg font-medium'>Scheduled Emails</h3>
                <p className='text-muted-foreground mt-1 text-sm'>
                  {sidebarCounts.scheduled > 0
                    ? `${sidebarCounts.scheduled} email${sidebarCounts.scheduled > 1 ? 's' : ''} scheduled to send.`
                    : 'No scheduled emails.'}
                </p>
              </div>
            ) : currentView === 'by-client' || currentView === 'by-project' ? (
              <div className='flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center'>
                <FolderKanban className='text-muted-foreground mb-4 h-12 w-12' />
                <h3 className='text-lg font-medium'>Coming Soon</h3>
                <p className='text-muted-foreground mt-1 text-sm'>
                  Browse by {currentView === 'by-client' ? 'client' : 'project'} is coming soon.
                </p>
              </div>
            ) : threads.length === 0 ? (
              <div className='flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center'>
                <Mail className='text-muted-foreground mb-4 h-12 w-12' />
                <h3 className='text-lg font-medium'>No threads found</h3>
                <p className='text-muted-foreground mt-1 text-sm'>
                  {!syncStatus.connected
                    ? 'Connect Gmail in Settings → Integrations to get started'
                    : filter !== 'all'
                      ? `No ${filter} threads found.`
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
        </section>
      </div>

      {/* Thread Detail Sheet - Two Column Layout (rendered via portal) */}
      <Sheet
        open={!!selectedThread}
        onOpenChange={open => !open && handleCloseSheet()}
      >
        <SheetContent className='flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-6xl'>
          {/* Custom Header - Outside the scroll area */}
          <div className='bg-muted/50 flex-shrink-0 border-b-2 px-6 pt-4 pb-3'>
            <div className='flex items-start justify-between gap-4'>
              <div className='min-w-0 flex-1 pr-10'>
                <SheetTitle className='line-clamp-2 text-lg'>
                  {selectedThread?.subject || '(no subject)'}
                </SheetTitle>
                <SheetDescription className='mt-1'>
                  {selectedThread?.messageCount} message
                  {selectedThread?.messageCount !== 1 && 's'}
                  {selectedThread?.lastMessageAt && (
                    <>
                      {' '}
                      · {format(new Date(selectedThread.lastMessageAt), 'PPp')}
                    </>
                  )}
                </SheetDescription>
              </div>
            </div>
          </div>

          {/* Two Column Content */}
          <div className='flex min-h-0 flex-1'>
            {/* Left Column - Email Messages */}
            <div className='flex-1 overflow-y-auto border-r'>
              <div className='p-6'>
                {isLoadingMessages ? (
                  <div className='flex items-center justify-center py-12'>
                    <RefreshCw className='text-muted-foreground h-6 w-6 animate-spin' />
                  </div>
                ) : threadMessages.length === 0 ? (
                  <div className='text-muted-foreground flex items-center justify-center py-12'>
                    No messages found
                  </div>
                ) : (
                  <div className='space-y-6'>
                    {threadMessages.map(message => (
                      <MessageCard
                        key={message.id}
                        message={message}
                        cidMappings={cidMappings[message.id]}
                        onReply={mode => handleReply(message, mode)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Metadata & Actions */}
            <div className='bg-muted/20 w-80 flex-shrink-0 overflow-y-auto lg:w-96'>
              <div className='space-y-6 p-6'>
                {/* Email Toolbar - Read/Unread toggle + Navigation */}
                {selectedThread && (
                  <EmailToolbar
                    threadId={selectedThread.id}
                    isRead={
                      threadMessages.length > 0 &&
                      threadMessages.every(m => m.isRead)
                    }
                    canGoPrev={canGoPrev}
                    canGoNext={canGoNext}
                    onToggleReadStatus={newIsRead => {
                      // Update local thread messages state
                      setThreadMessages(prev =>
                        prev.map(m => ({ ...m, isRead: newIsRead }))
                      )
                      // Update threads list state
                      setThreads(prev =>
                        prev.map(t =>
                          t.id === selectedThread.id && t.latestMessage
                            ? {
                                ...t,
                                latestMessage: {
                                  ...t.latestMessage,
                                  isRead: newIsRead,
                                },
                              }
                            : t
                        )
                      )
                    }}
                    onPrev={goToPrev}
                    onNext={goToNext}
                  />
                )}

                {/* Contact Detection Section */}
                {isAdmin && selectedThread && (
                  <>
                    <Separator />
                    <ThreadContactPanel
                      threadId={selectedThread.id}
                      participantEmails={selectedThread.participantEmails || []}
                    />
                  </>
                )}

                {/* Client Linking Section */}
                {isAdmin && selectedThread && (
                  <>
                    <Separator />
                    <ThreadLinkingPanel
                      thread={selectedThread}
                      clients={clients}
                      suggestions={suggestions}
                      suggestionsLoading={suggestionsLoading}
                      isLinking={isLinking}
                      onLinkClient={handleLinkClient}
                      onUnlinkClient={handleUnlinkClient}
                    />
                  </>
                )}

                {/* Project Linking Section */}
                {isAdmin && selectedThread && (
                  <>
                    <Separator />
                    <ThreadProjectLinkingPanel
                      thread={selectedThread}
                      projects={projects}
                      suggestions={projectSuggestions}
                      suggestionsLoading={projectSuggestionsLoading}
                      isLinking={isLinkingProject}
                      onLinkProject={handleLinkProject}
                      onUnlinkProject={handleUnlinkProject}
                    />
                  </>
                )}

                {isAdmin && selectedThread && (
                  <>
                    <Separator />
                    {/* AI Task/PR Suggestions */}
                    <ThreadSuggestionsPanel
                      threadId={selectedThread.id}
                      isAdmin={isAdmin}
                      refreshTrigger={suggestionRefreshKey}
                      isAnalyzing={isAnalyzingThread}
                      hasClient={!!selectedThread.client}
                      hasProject={!!selectedThread.project}
                      onRefresh={() => triggerThreadAnalysis(selectedThread.id)}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Compose Panel - slides in from right */}
            {composeContext && (
              <div className='w-96 flex-shrink-0 border-l'>
                <ComposePanel
                  context={composeContext}
                  onClose={() => setComposeContext(null)}
                  onSent={() => {
                    setComposeContext(null)
                    // Refresh messages after sending
                    if (selectedThread) {
                      fetch(`/api/threads/${selectedThread.id}/messages`)
                        .then(r => r.json())
                        .then(data => {
                          setThreadMessages(data.messages || [])
                          setCidMappings(data.cidMappings || {})
                        })
                        .catch(console.error)
                    }
                  }}
                />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

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
    </>
  )
}

