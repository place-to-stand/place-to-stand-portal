'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { CheckCircle, FileText } from 'lucide-react'

import { PaginationControls } from '@/components/ui/pagination-controls'
import { useToast } from '@/components/ui/use-toast'
import type { TranscriptSummary } from '@/lib/queries/transcripts'

import { TranscriptCompactRow } from './transcript-compact-row'
import { TranscriptDetailSheet } from './transcript-detail-sheet'
import { TranscriptSidebar, type TranscriptView } from './transcript-sidebar'
import { TranscriptToolbar } from './transcript-toolbar'
import { useInboxSearch } from './hooks/use-inbox-search'

type Client = { id: string; name: string; slug: string | null }
type Project = {
  id: string
  name: string
  slug: string | null
  clientId: string | null
  type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
  ownerId: string | null
  createdBy: string | null
}
type Lead = { id: string; contactName: string }

type ViewType = 'inbox' | 'unclassified' | 'classified' | 'dismissed'

interface TranscriptPanelProps {
  transcripts: TranscriptSummary[]
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  currentUserId: string
  view: ViewType
  searchQuery: string
  sidebarCounts: {
    total: number
    unclassified: number
    classified: number
    dismissed: number
  }
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    pageSize: number
  }
  initialSelectedTranscript?: TranscriptSummary | null
  filterClientId?: string
  filterProjectId?: string
  filterLeadId?: string
}

export function TranscriptPanel({
  transcripts: initialTranscripts,
  clients,
  projects,
  leads,
  currentUserId,
  view,
  searchQuery,
  sidebarCounts,
  pagination,
  initialSelectedTranscript,
  filterClientId,
  filterProjectId,
  filterLeadId,
}: TranscriptPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { toast } = useToast()
  const [isFilterPending, startFilterTransition] = useTransition()

  const [transcripts, setTranscripts] = useState(initialTranscripts)
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptSummary | null>(null)

  const currentView: TranscriptView = view

  // Optimistic local filter state
  const [localFilters, setLocalFilters] = useState({
    client: filterClientId,
    project: filterProjectId,
    lead: filterLeadId,
  })

  // Sync local filters when server props arrive
  useEffect(() => {
    setLocalFilters({
      client: filterClientId,
      project: filterProjectId,
      lead: filterLeadId,
    })
  }, [filterClientId, filterProjectId, filterLeadId])

  // Sync transcripts when props change
  useEffect(() => {
    setTranscripts(initialTranscripts)
  }, [initialTranscripts])

  // Search hook
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

  // Handle transcript click — select and update URL
  const handleTranscriptClick = useCallback(
    (transcript: TranscriptSummary) => {
      setSelectedTranscript(transcript)
      const params = new URLSearchParams(searchParams.toString())
      params.set('transcript', transcript.id)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, searchParams, pathname]
  )

  // Guard ref: prevents URL-sync effect from re-opening a sheet we just closed
  const justClosedRef = useRef(false)

  // Handle closing the sheet
  const handleCloseSheet = useCallback(() => {
    justClosedRef.current = true
    setSelectedTranscript(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('transcript')
    const newUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname
    router.push(newUrl, { scroll: false })
  }, [router, searchParams, pathname])

  // Handle URL-based transcript selection on mount / URL changes
  useEffect(() => {
    if (justClosedRef.current) {
      justClosedRef.current = false
      return
    }
    const tid = searchParams.get('transcript')
    if (tid) {
      const found = transcripts.find(t => t.id === tid)
      if (found && (!selectedTranscript || selectedTranscript.id !== tid)) {
        setSelectedTranscript(found)
      } else if (
        !found &&
        initialSelectedTranscript &&
        initialSelectedTranscript.id === tid &&
        (!selectedTranscript || selectedTranscript.id !== tid)
      ) {
        setSelectedTranscript(initialSelectedTranscript as TranscriptSummary)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, transcripts, initialSelectedTranscript])

  // Classify a transcript — update in-place so the sheet shows the classified state
  const handleClassify = useCallback(async (
    transcriptId: string,
    linkData: { clientId?: string; projectId?: string; leadId?: string }
  ) => {
    const res = await fetch(`/api/transcripts/${transcriptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...linkData, classification: 'CLASSIFIED' }),
    })

    if (res.ok) {
      const updatedTranscript = (prev: TranscriptSummary): TranscriptSummary => ({
        ...prev,
        classification: 'CLASSIFIED',
        clientId: linkData.clientId ?? prev.clientId,
        projectId: linkData.projectId ?? prev.projectId,
        leadId: linkData.leadId ?? prev.leadId,
      })
      setTranscripts(prev => prev.map(t =>
        t.id === transcriptId ? updatedTranscript(t) : t
      ))
      setSelectedTranscript(prev =>
        prev?.id === transcriptId ? updatedTranscript(prev) : prev
      )
      toast({ title: 'Transcript classified' })
    }
  }, [toast])

  // Dismiss a transcript — update in-place so the sheet shows the dismissed state
  const handleDismiss = useCallback(async (transcriptId: string) => {
    const res = await fetch(`/api/transcripts/${transcriptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classification: 'DISMISSED' }),
    })

    if (res.ok) {
      const updatedTranscript = (prev: TranscriptSummary): TranscriptSummary => ({
        ...prev,
        classification: 'DISMISSED',
        clientId: null,
        projectId: null,
        leadId: null,
      })
      setTranscripts(prev => prev.map(t =>
        t.id === transcriptId ? updatedTranscript(t) : t
      ))
      setSelectedTranscript(prev =>
        prev?.id === transcriptId ? updatedTranscript(prev) : prev
      )
      toast({ title: 'Transcript dismissed' })
    }
  }, [toast])

  // Undo dismiss — revert to unclassified
  const handleUndoDismiss = useCallback(async (transcriptId: string) => {
    const res = await fetch(`/api/transcripts/${transcriptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classification: 'UNCLASSIFIED' }),
    })

    if (res.ok) {
      const updatedTranscript = (prev: TranscriptSummary): TranscriptSummary => ({
        ...prev,
        classification: 'UNCLASSIFIED',
      })
      setTranscripts(prev => prev.map(t =>
        t.id === transcriptId ? updatedTranscript(t) : t
      ))
      setSelectedTranscript(prev =>
        prev?.id === transcriptId ? updatedTranscript(prev) : prev
      )
      toast({ title: 'Dismiss undone' })
    }
  }, [toast])

  // Unlink entities — remove client/project/lead links
  // If all entities end up null, revert classification to UNCLASSIFIED
  const handleUnlink = useCallback(async (
    transcriptId: string,
    unlinkData: { clientId?: null; projectId?: null; leadId?: null }
  ) => {
    // Compute what the transcript will look like after unlink
    const current = transcripts.find(t => t.id === transcriptId)
    const nextClientId = 'clientId' in unlinkData ? null : current?.clientId ?? null
    const nextProjectId = 'projectId' in unlinkData ? null : current?.projectId ?? null
    const nextLeadId = 'leadId' in unlinkData ? null : current?.leadId ?? null
    const allCleared = !nextClientId && !nextProjectId && !nextLeadId

    const patchBody = allCleared
      ? { ...unlinkData, classification: 'UNCLASSIFIED' }
      : unlinkData

    const res = await fetch(`/api/transcripts/${transcriptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    })

    if (res.ok) {
      const updatedTranscript = (prev: TranscriptSummary): TranscriptSummary => ({
        ...prev,
        ...('clientId' in unlinkData ? { clientId: null } : {}),
        ...('projectId' in unlinkData ? { projectId: null } : {}),
        ...('leadId' in unlinkData ? { leadId: null } : {}),
        ...(allCleared ? { classification: 'UNCLASSIFIED' } : {}),
      })
      setTranscripts(prev => prev.map(t =>
        t.id === transcriptId ? updatedTranscript(t) : t
      ))
      setSelectedTranscript(prev =>
        prev?.id === transcriptId ? updatedTranscript(prev) : prev
      )

      const unlinked = 'clientId' in unlinkData ? 'Client' : 'projectId' in unlinkData ? 'Project' : 'Lead'
      toast({ title: `${unlinked} unlinked` })
    }
  }, [toast, transcripts])

  // Page changes
  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('transcript')
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

  // Mobile view change
  const handleMobileViewChange = useCallback(
    (newView: string) => {
      if (newView === 'inbox') {
        router.push('/my/communications/transcripts')
      } else {
        router.push(`/my/communications/transcripts/${newView}`)
      }
    },
    [router]
  )

  // Filter changes
  const handleFilterChange = useCallback(
    (key: 'client' | 'project' | 'lead', value: string | undefined) => {
      setLocalFilters(prev => ({ ...prev, [key]: value }))

      const params = new URLSearchParams(searchParams.toString())
      params.delete('transcript')
      params.delete('page')
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname
      startFilterTransition(() => {
        router.push(newUrl)
      })
    },
    [router, searchParams, pathname, startFilterTransition]
  )

  const handleClearFilters = useCallback(() => {
    setLocalFilters({ client: undefined, project: undefined, lead: undefined })
    const params = new URLSearchParams(searchParams.toString())
    params.delete('transcript')
    params.delete('page')
    params.delete('client')
    params.delete('project')
    params.delete('lead')
    const newUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname
    startFilterTransition(() => {
      router.push(newUrl)
    })
  }, [router, searchParams, pathname, startFilterTransition])

  return (
    <>
      <div className='space-y-4'>
        <section className='bg-background flex min-h-[calc(100vh-13rem)] min-w-0 flex-col overflow-hidden rounded-xl border shadow-sm'>
          {/* Toolbar */}
          <div className='border-b px-6 py-4'>
            <TranscriptToolbar
              currentView={currentView}
              onViewChange={handleMobileViewChange}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              isSearching={isSearching}
              onClearSearch={handleClearSearch}
              unclassifiedCount={sidebarCounts.unclassified}
              clients={clients}
              projects={projects}
              leads={leads}
              filterClientId={localFilters.client}
              filterProjectId={localFilters.project}
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
              <TranscriptSidebar
                currentView={currentView}
                counts={sidebarCounts}
                preservedParams={{
                  transcript: searchParams.get('transcript'),
                  q: searchParams.get('q'),
                  client: searchParams.get('client'),
                  project: searchParams.get('project'),
                  lead: searchParams.get('lead'),
                }}
              />
            </aside>

            {/* Main Content */}
            <div className='flex min-w-0 flex-1 flex-col p-6'>
              <div className='flex min-w-0 flex-1 flex-col space-y-4'>
                {transcripts.length === 0 ? (
                  <div className='flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center'>
                    {currentView === 'unclassified' ? (
                      <>
                        <CheckCircle className='mb-4 h-12 w-12 text-green-500' />
                        <h3 className='text-lg font-medium'>All caught up!</h3>
                        <p className='text-muted-foreground mt-1 text-sm'>
                          No unclassified transcripts to review.
                        </p>
                      </>
                    ) : (
                      <>
                        <FileText className='text-muted-foreground mb-4 h-12 w-12' />
                        <h3 className='text-lg font-medium'>
                          {currentView === 'inbox' ? 'No transcripts' : `No ${currentView} transcripts`}
                        </h3>
                        <p className='text-muted-foreground mt-1 text-sm'>
                          {searchInput
                            ? 'Try a different search term.'
                            : currentView === 'inbox'
                              ? 'No transcripts synced yet.'
                              : `No transcripts have been ${currentView} yet.`}
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className='overflow-hidden rounded-lg border'>
                      {transcripts.map((transcript, idx) => (
                        <TranscriptCompactRow
                          key={transcript.id}
                          transcript={transcript}
                          clients={clients}
                          projects={projects}
                          leads={leads}
                          isSelected={selectedTranscript?.id === transcript.id}
                          isFirst={idx === 0}
                          onClick={() => handleTranscriptClick(transcript)}
                        />
                      ))}
                    </div>

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

      {/* Transcript Detail Sheet */}
      <TranscriptDetailSheet
        transcript={selectedTranscript}
        clients={clients}
        projects={projects}
        leads={leads}
        currentUserId={currentUserId}
        onClassify={handleClassify}
        onDismiss={handleDismiss}
        onUndoDismiss={handleUndoDismiss}
        onUnlink={handleUnlink}
        onClose={handleCloseSheet}
      />
    </>
  )
}
