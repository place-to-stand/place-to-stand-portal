'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { CheckCircle, FileText, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import type { TranscriptSummary } from '@/lib/queries/transcripts'

import { TranscriptRow } from './transcript-row'
import { useBatchSelection } from './hooks/use-batch-selection'

type Client = { id: string; name: string }
type Project = { id: string; name: string; clientId: string | null }
type Lead = { id: string; contactName: string }
type ViewType = 'unclassified' | 'classified' | 'dismissed'

interface TranscriptListViewProps {
  transcripts: TranscriptSummary[]
  counts: { unclassified: number; classified: number; dismissed: number }
  currentView: ViewType
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  searchQuery: string
}

const DISMISS_BEFORE_OPTIONS = [
  { label: '1 week ago', days: 7 },
  { label: '1 month ago', days: 30 },
  { label: '3 months ago', days: 90 },
  { label: '6 months ago', days: 180 },
  { label: '1 year ago', days: 365 },
] as const

export function TranscriptListView({
  transcripts: initialTranscripts,
  counts: initialCounts,
  currentView,
  clients,
  projects,
  leads,
  searchQuery: initialSearch,
}: TranscriptListViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()

  const [transcripts, setTranscripts] = useState(initialTranscripts)
  const [counts, setCounts] = useState(initialCounts)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedContent, setExpandedContent] = useState<string | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [analyzeQueue, setAnalyzeQueue] = useState<Set<string>>(new Set())
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Keep transcripts in sync with server-rendered data
  useEffect(() => {
    setTranscripts(initialTranscripts)
  }, [initialTranscripts])

  useEffect(() => {
    setCounts(initialCounts)
  }, [initialCounts])

  const transcriptIds = useMemo(() => transcripts.map(t => t.id), [transcripts])
  const {
    selectedCount,
    toggle,
    selectAll,
    clearSelection,
    isSelected,
    selectedIds,
  } = useBatchSelection(transcriptIds)

  // Sub-tab navigation
  const handleViewChange = useCallback((view: string) => {
    const base = '/my/inbox/transcripts'
    const path = view === 'unclassified' ? base : `${base}/${view}`
    router.push(path)
  }, [router])

  // Search with debounce
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      const base = pathname
      const params = new URLSearchParams()
      if (value.trim()) params.set('q', value.trim())
      const qs = params.toString()
      router.push(qs ? `${base}?${qs}` : base)
    }, 300)
  }, [pathname, router])

  // Expand transcript to show content
  const handleExpand = useCallback(async (transcriptId: string) => {
    if (expandedId === transcriptId) {
      setExpandedId(null)
      setExpandedContent(null)
      return
    }

    setExpandedId(transcriptId)
    setExpandedContent(null)
    setIsLoadingContent(true)

    try {
      const res = await fetch(`/api/transcripts/${transcriptId}`)
      if (res.ok) {
        const data = await res.json()
        setExpandedContent(data.transcript?.content ?? null)
      }
    } catch (err) {
      console.error('Failed to load transcript content:', err)
    } finally {
      setIsLoadingContent(false)
    }
  }, [expandedId])

  // Classify a transcript
  const handleAccept = useCallback(async (
    transcriptId: string,
    linkData: { clientId?: string; projectId?: string; leadId?: string }
  ) => {
    const res = await fetch(`/api/transcripts/${transcriptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...linkData, classification: 'CLASSIFIED' }),
    })

    if (res.ok) {
      setTranscripts(prev => prev.filter(t => t.id !== transcriptId))
      setCounts(prev => ({
        ...prev,
        unclassified: prev.unclassified - 1,
        classified: prev.classified + 1,
      }))
      router.refresh()
      toast({ title: 'Transcript classified' })
    }
  }, [router, toast])

  // Dismiss a single transcript
  const handleDismiss = useCallback(async (transcriptId: string) => {
    const res = await fetch(`/api/transcripts/${transcriptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classification: 'DISMISSED' }),
    })

    if (res.ok) {
      setTranscripts(prev => prev.filter(t => t.id !== transcriptId))
      setCounts(prev => ({
        ...prev,
        unclassified: prev.unclassified - 1,
        dismissed: prev.dismissed + 1,
      }))
      router.refresh()
      toast({ title: 'Transcript dismissed' })
    }
  }, [router, toast])

  // Batch dismiss selected
  const handleBatchDismiss = useCallback(async () => {
    const ids = Array.from(selectedIds)
    const res = await fetch('/api/transcripts/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', ids }),
    })

    if (res.ok) {
      const data = await res.json()
      setTranscripts(prev => prev.filter(t => !selectedIds.has(t.id)))
      setCounts(prev => ({
        ...prev,
        unclassified: prev.unclassified - data.dismissed,
        dismissed: prev.dismissed + data.dismissed,
      }))
      clearSelection()
      router.refresh()
      toast({
        title: `Dismissed ${data.dismissed} transcript${data.dismissed !== 1 ? 's' : ''}`,
      })
    }
  }, [selectedIds, clearSelection, router, toast])

  // Batch analyze selected
  const handleBatchAnalyze = useCallback(() => {
    setAnalyzeQueue(new Set(selectedIds))
  }, [selectedIds])

  const handleAnalyzeStarted = useCallback((transcriptId: string) => {
    setAnalyzeQueue(prev => {
      const next = new Set(prev)
      next.delete(transcriptId)
      return next
    })
  }, [])

  // Dismiss older than...
  const handleDismissBefore = useCallback(async (days: number) => {
    const before = new Date()
    before.setDate(before.getDate() - days)

    const res = await fetch('/api/transcripts/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss_before', before: before.toISOString() }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.dismissed > 0) {
        router.refresh()
        toast({
          title: `Dismissed ${data.dismissed} older transcript${data.dismissed !== 1 ? 's' : ''}`,
        })
      } else {
        toast({ title: 'No transcripts to dismiss in that range' })
      }
    }
  }, [router, toast])

  // Eager AI analysis on mount — fire analyze for unanalyzed transcripts
  const hasEagerAnalyzed = useRef(false)
  useEffect(() => {
    if (hasEagerAnalyzed.current || currentView !== 'unclassified') return
    hasEagerAnalyzed.current = true

    const unanalyzed = transcripts.filter(t => !t.aiAnalyzedAt)
    if (unanalyzed.length === 0) return

    // Fire in batches of 5
    const batch = unanalyzed.slice(0, 5)
    batch.forEach(t => {
      fetch(`/api/transcripts/${t.id}/analyze`, { method: 'POST' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data?.suggestion) return
          // Update the transcript in-place with the new AI suggestion
          setTranscripts(prev => prev.map(existing =>
            existing.id === t.id
              ? {
                  ...existing,
                  aiSuggestedClientId: data.suggestion.clientId,
                  aiSuggestedClientName: data.suggestion.clientName,
                  aiSuggestedProjectId: data.suggestion.projectId,
                  aiSuggestedProjectName: data.suggestion.projectName,
                  aiSuggestedLeadId: data.suggestion.leadId,
                  aiSuggestedLeadName: data.suggestion.leadName,
                  aiConfidence: data.suggestion.confidence?.toString() ?? null,
                  aiAnalyzedAt: data.suggestion.analyzedAt ?? new Date().toISOString(),
                }
              : existing
          ))
        })
        .catch(() => {})
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <section className='bg-background flex min-h-[calc(100vh-13rem)] min-w-0 flex-col overflow-hidden rounded-xl border shadow-sm'>
        {/* Sub-tabs + search */}
        <div className='space-y-3 border-b px-4 py-3'>
          <div className='flex items-center justify-between gap-4'>
            <Tabs value={currentView} onValueChange={handleViewChange}>
              <TabsList className='bg-muted/40 h-9'>
                <TabsTrigger value='unclassified' className='text-xs'>
                  Unclassified
                  {counts.unclassified > 0 && (
                    <span className='bg-primary text-primary-foreground ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium'>
                      {counts.unclassified}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value='classified' className='text-xs'>
                  Classified
                  <span className='text-muted-foreground ml-1.5 text-[10px]'>
                    {counts.classified}
                  </span>
                </TabsTrigger>
                <TabsTrigger value='dismissed' className='text-xs'>
                  Dismissed
                  <span className='text-muted-foreground ml-1.5 text-[10px]'>
                    {counts.dismissed}
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {currentView === 'unclassified' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='sm' className='text-xs'>
                    Dismiss older than...
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  {DISMISS_BEFORE_OPTIONS.map(opt => (
                    <DropdownMenuItem
                      key={opt.days}
                      onClick={() => handleDismissBefore(opt.days)}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Search */}
          <div className='relative'>
            <Search className='text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2' />
            <Input
              placeholder='Search transcripts...'
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              className='h-9 pl-9 pr-8 text-sm'
            />
            {searchInput && (
              <button
                type='button'
                className='text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2'
                onClick={() => handleSearchChange('')}
              >
                <X className='h-4 w-4' />
              </button>
            )}
          </div>
        </div>

        {/* Select all toolbar (unclassified view only) */}
        {currentView === 'unclassified' && transcripts.length > 0 && (
          <div className='flex items-center justify-between border-b px-4 py-2'>
            <div className='flex items-center gap-3'>
              <Checkbox
                checked={selectedCount === transcripts.length && transcripts.length > 0}
                onCheckedChange={checked => {
                  if (checked) selectAll()
                  else clearSelection()
                }}
                className='h-4 w-4'
              />
              <span className='text-muted-foreground text-sm'>
                {selectedCount > 0
                  ? `${selectedCount} of ${transcripts.length} selected`
                  : `${transcripts.length} transcript${transcripts.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>
        )}

        {/* Transcript list */}
        {transcripts.length === 0 ? (
          <div className='flex flex-1 items-center justify-center'>
            <div className='flex flex-col items-center p-12 text-center'>
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
                    No {currentView} transcripts
                  </h3>
                  <p className='text-muted-foreground mt-1 text-sm'>
                    {searchInput
                      ? 'Try a different search term.'
                      : `No transcripts have been ${currentView} yet.`}
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className='flex-1'>
            {transcripts.map(transcript => (
              <TranscriptRow
                key={transcript.id}
                transcript={transcript}
                clients={clients}
                projects={projects}
                leads={leads}
                isChecked={isSelected(transcript.id)}
                shouldAnalyze={analyzeQueue.has(transcript.id)}
                onAnalyzeStarted={() => handleAnalyzeStarted(transcript.id)}
                onToggle={shiftKey => toggle(transcript.id, shiftKey)}
                onAccept={handleAccept}
                onDismiss={handleDismiss}
                onExpand={handleExpand}
                isExpanded={expandedId === transcript.id}
                expandedContent={expandedId === transcript.id ? expandedContent : null}
                isLoadingContent={expandedId === transcript.id && isLoadingContent}
              />
            ))}
          </div>
        )}
      </section>

      {/* Batch toolbar — fixed bottom bar */}
      {selectedCount > 0 && (
        <div className='bg-background fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-4 py-2.5 shadow-lg'>
          <div className='flex items-center gap-3'>
            <span className='text-sm font-medium'>
              {selectedCount} selected
            </span>
            <Button
              variant='outline'
              size='sm'
              onClick={handleBatchAnalyze}
            >
              Analyze {selectedCount}
            </Button>
            <Button
              variant='destructive'
              size='sm'
              onClick={handleBatchDismiss}
            >
              Dismiss {selectedCount}
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={clearSelection}
            >
              <X className='mr-1 h-3.5 w-3.5' />
              Clear
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
