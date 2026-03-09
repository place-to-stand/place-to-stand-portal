'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Building2,
  Check,
  FolderKanban,
  Loader2,
  UserCircle,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Client = { id: string; name: string; slug?: string | null }
type Project = { id: string; name: string; slug?: string | null; clientId: string | null; type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'; ownerId?: string | null; createdBy?: string | null }
type Lead = { id: string; contactName: string; contactEmail?: string | null }
type Track = 'client' | 'internal' | 'lead'
type AnalysisState = 'idle' | 'analyzing' | 'done' | 'error'

interface AISuggestion {
  clientId?: string | null
  clientName?: string | null
  projectId?: string | null
  projectName?: string | null
  leadId?: string | null
  leadName?: string | null
  confidence?: number | string | null
}

interface ClassifierControlsProps {
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  currentUserId: string
  // AI suggestion state — pre-populated from cache or live analysis
  aiSuggestion?: AISuggestion | null
  aiAnalyzedAt?: string | null
  // Analysis callbacks
  onAnalyze: () => Promise<AISuggestion | null>
  shouldAnalyze?: boolean
  onAnalyzeStarted?: () => void
  // Actions
  onAccept: (linkData: { clientId?: string; projectId?: string; leadId?: string }) => Promise<void>
  onDismiss: () => void | Promise<void>
  // DB-based suggestions (email only — fast per-request matching)
  dbClientSuggestion?: { clientId: string; clientName: string } | null
  dbLeadSuggestion?: { leadId: string; contactName: string } | null
}

export function ClassifierControls({
  clients,
  projects,
  leads,
  currentUserId,
  aiSuggestion,
  aiAnalyzedAt,
  onAnalyze,
  shouldAnalyze,
  onAnalyzeStarted,
  onAccept,
  onDismiss,
  dbClientSuggestion,
  dbLeadSuggestion,
}: ClassifierControlsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Determine initial track from AI suggestion or DB suggestion
  const initialTrack: Track = aiSuggestion?.clientId
    ? 'client'
    : aiSuggestion?.leadId
      ? 'lead'
      : dbClientSuggestion
        ? 'client'
        : dbLeadSuggestion
          ? 'lead'
          : 'client'

  const [track, setTrack] = useState<Track>(initialTrack)
  const [selectedClientId, setSelectedClientId] = useState<string>(
    aiSuggestion?.clientId ?? dbClientSuggestion?.clientId ?? ''
  )
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    aiSuggestion?.projectId ?? ''
  )
  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    aiSuggestion?.leadId ?? dbLeadSuggestion?.leadId ?? ''
  )
  const [selectedInternalProjectId, setSelectedInternalProjectId] = useState<string>('')

  // AI analysis state
  const [analysisState, setAnalysisState] = useState<AnalysisState>(
    aiAnalyzedAt ? 'done' : 'idle'
  )
  const [analysisTrack, setAnalysisTrack] = useState<Track | null>(
    aiAnalyzedAt && aiSuggestion?.clientId ? 'client'
      : aiAnalyzedAt && aiSuggestion?.leadId ? 'lead'
        : null
  )
  // User clicked "Classify manually" — suppress dismiss overlay
  const [manualClassify, setManualClassify] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const hasAutoAnalyzed = useRef(!!aiAnalyzedAt)

  // Derived: show dismiss overlay when analysis completed with no match
  // This is derived from state, not set explicitly — no code path can miss it
  const isAnalyzed = analysisState === 'done'
  const showDismissOverlay = isAnalyzed && !analysisTrack && !manualClassify

  const filteredProjects = useMemo(() => {
    if (!selectedClientId) return []
    return projects.filter(p => p.clientId === selectedClientId)
  }, [selectedClientId, projects])

  const internalProjectGroups = useMemo(() => {
    const internal = projects.filter(p => p.type === 'INTERNAL')
    const personal = projects.filter(p => p.type === 'PERSONAL' && (p.ownerId ?? p.createdBy) === currentUserId)
    return { internal, personal }
  }, [projects, currentUserId])

  const hasValidSelection =
    track === 'client' ? !!selectedClientId
    : track === 'internal' ? !!selectedInternalProjectId
    : !!selectedLeadId

  const cancelAnalysis = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setManualClassify(true)
    setAnalysisState('done')
  }, [])

  const handleAnalyze = useCallback(async () => {
    setAnalysisState('analyzing')
    setManualClassify(false)
    try {
      const suggestion = await onAnalyze()

      if (suggestion?.clientId) {
        setTrack('client')
        setAnalysisTrack('client')
        setSelectedClientId(suggestion.clientId)
        if (suggestion.projectId) setSelectedProjectId(suggestion.projectId)
      } else if (suggestion?.projectId) {
        const matchedProject = projects.find(p => p.id === suggestion.projectId)
        const isAccessibleInternal = matchedProject && (
          matchedProject.type === 'INTERNAL' ||
          (matchedProject.type === 'PERSONAL' && (matchedProject.ownerId ?? matchedProject.createdBy) === currentUserId)
        )
        if (isAccessibleInternal) {
          setTrack('internal')
          setAnalysisTrack('internal')
          setSelectedInternalProjectId(suggestion.projectId)
        }
        // No match → analysisTrack stays null → dismiss overlay shows
      } else if (suggestion?.leadId) {
        setTrack('lead')
        setAnalysisTrack('lead')
        setSelectedLeadId(suggestion.leadId)
      }
      // No explicit setSuggestDismiss needed — derived from analysisTrack === null

      setAnalysisState('done')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Classification analysis error:', err)
      setAnalysisState('error')
    }
  }, [onAnalyze, projects, currentUserId])

  // Auto-analyze on mount if not already cached
  useEffect(() => {
    if (hasAutoAnalyzed.current) return
    hasAutoAnalyzed.current = true
    handleAnalyze()
  }, [handleAnalyze])

  // Batch analyze trigger
  useEffect(() => {
    if (shouldAnalyze && analysisState === 'idle') {
      onAnalyzeStarted?.()
      handleAnalyze()
    }
  }, [shouldAnalyze, analysisState, onAnalyzeStarted, handleAnalyze])

  const handleAccept = async () => {
    if (!hasValidSelection) return
    setIsSubmitting(true)
    try {
      await onAccept({
        ...(track === 'client' ? {
          clientId: selectedClientId,
          projectId: selectedProjectId || undefined,
        } : track === 'internal' ? {
          projectId: selectedInternalProjectId,
        } : {
          leadId: selectedLeadId,
        }),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='relative flex w-full min-w-0 flex-col rounded-lg border bg-muted/30 p-2.5' onClick={e => e.stopPropagation()}>
      {/* Analyzing spinner overlay */}
      {analysisState === 'analyzing' && (
        <div className='absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/60 backdrop-blur-[2px]'>
          <div className='flex items-center gap-2 text-xs'>
            <Loader2 className='h-3.5 w-3.5 animate-spin' />
            Analyzing...
          </div>
          <button
            type='button'
            className='text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 hover:underline transition-colors'
            onClick={cancelAnalysis}
          >
            Classify manually
          </button>
        </div>
      )}

      {/* Error state overlay */}
      {analysisState === 'error' && (
        <div className='absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-background/60 backdrop-blur-[2px]'>
          <span className='text-muted-foreground text-xs'>Analysis failed</span>
          <Button
            size='sm'
            variant='outline'
            className='h-7 text-xs'
            onClick={handleAnalyze}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Dismiss suggestion — analysis completed with no matches */}
      {showDismissOverlay && (
        <div className='absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/60 backdrop-blur-[2px]'>
          <span className='text-muted-foreground text-xs'>No matches found</span>
          <Button
            size='sm'
            variant='destructive'
            className='h-8 gap-1 text-xs'
            onClick={onDismiss}
            disabled={isSubmitting}
          >
            <XCircle className='h-3 w-3' />
            Dismiss
          </Button>
          <button
            type='button'
            className='text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 hover:underline transition-colors'
            onClick={() => setManualClassify(true)}
          >
            Classify manually
          </button>
        </div>
      )}

      {/* Segmented track toggle */}
      <div className='bg-muted/60 flex rounded-md p-0.5'>
        <button
          type='button'
          onClick={() => setTrack('client')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-sm px-1.5 py-1 text-xs font-medium transition-all',
            track === 'client'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Building2 className='h-3 w-3' />
          Client
          {isAnalyzed && analysisTrack === 'client' && (
            <span className='text-[9px] font-normal opacity-60'>AI</span>
          )}
        </button>
        <button
          type='button'
          onClick={() => setTrack('internal')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-sm px-1.5 py-1 text-xs font-medium transition-all',
            track === 'internal'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FolderKanban className='h-3 w-3' />
          Internal
          {isAnalyzed && analysisTrack === 'internal' && (
            <span className='text-[9px] font-normal opacity-60'>AI</span>
          )}
        </button>
        <button
          type='button'
          onClick={() => setTrack('lead')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-sm px-1.5 py-1 text-xs font-medium transition-all',
            track === 'lead'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <UserCircle className='h-3 w-3' />
          Lead
          {isAnalyzed && analysisTrack === 'lead' && (
            <span className='text-[9px] font-normal opacity-60'>AI</span>
          )}
        </button>
      </div>

      {/* Fields */}
      <div className='mt-2 space-y-1.5'>
        {track === 'client' && (
          <>
            <Select value={selectedClientId} onValueChange={id => {
              setSelectedClientId(id)
              setSelectedProjectId('')
            }}>
              <SelectTrigger className='h-8 w-full border-transparent bg-background/60 text-xs shadow-none'>
                <SelectValue placeholder='Select client...' />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedClientId && filteredProjects.length > 0 && (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className='h-8 w-full border-transparent bg-background/60 text-xs shadow-none'>
                  <SelectValue placeholder='Project (optional)' />
                </SelectTrigger>
                <SelectContent>
                  {filteredProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <FolderKanban className='mr-1 inline h-3 w-3' />
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}

        {track === 'internal' && (
          <Select value={selectedInternalProjectId} onValueChange={setSelectedInternalProjectId}>
            <SelectTrigger className='h-8 w-full border-transparent bg-background/60 text-xs shadow-none'>
              <SelectValue placeholder='Select project...' />
            </SelectTrigger>
            <SelectContent>
              {internalProjectGroups.internal.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Internal</SelectLabel>
                  {internalProjectGroups.internal.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <FolderKanban className='mr-1 inline h-3 w-3' />
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {internalProjectGroups.personal.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Personal</SelectLabel>
                  {internalProjectGroups.personal.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <FolderKanban className='mr-1 inline h-3 w-3' />
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        )}

        {track === 'lead' && (
          <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
            <SelectTrigger className='h-8 w-full border-transparent bg-background/60 text-xs shadow-none'>
              <SelectValue placeholder='Select lead...' />
            </SelectTrigger>
            <SelectContent>
              {leads.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {l.contactName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Action buttons */}
      <div className='mt-2 flex gap-1.5'>
        <Button
          size='sm'
          className='h-8 flex-1 text-xs'
          onClick={handleAccept}
          disabled={!hasValidSelection || isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className='h-3 w-3 animate-spin' />
          ) : (
            <Check className='h-3 w-3' />
          )}
          Classify
        </Button>
        <Button
          variant='ghost'
          size='sm'
          className='text-muted-foreground hover:text-destructive h-8 flex-1 text-xs'
          onClick={onDismiss}
          disabled={isSubmitting}
        >
          <XCircle className='h-3 w-3' />
          Dismiss
        </Button>
      </div>
    </div>
  )
}
