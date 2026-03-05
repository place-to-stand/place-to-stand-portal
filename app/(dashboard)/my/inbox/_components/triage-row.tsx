'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Building2,
  Check,
  FolderKanban,
  HelpCircle,
  Loader2,
  Mail,
  Sparkles,
  UserCircle,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import type { TriageThread } from './triage-view'

type Client = { id: string; name: string; slug: string | null }
type Project = { id: string; name: string; slug: string | null; clientId: string | null }
type Lead = { id: string; contactName: string; contactEmail: string | null }

type AISuggestion = {
  clientId?: string
  clientName?: string
  projectId?: string
  projectName?: string
  confidence: number
  reasoning?: string
  matchType?: string
}

interface TriageRowProps {
  thread: TriageThread
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  isChecked: boolean
  onToggle: (shiftKey: boolean) => void
  onAccept: (threadId: string, linkData: { clientId?: string; projectId?: string; leadId?: string }) => Promise<void>
  onDismiss: () => void
  onViewThread: (thread: TriageThread) => void
}

type Track = 'client' | 'lead'
type AnalysisState = 'idle' | 'analyzing' | 'done' | 'error'

export function TriageRow({
  thread,
  clients,
  projects,
  leads,
  isChecked,
  onToggle,
  onAccept,
  onDismiss,
  onViewThread,
}: TriageRowProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const initialTrack: Track = thread.clientSuggestion ? 'client' : thread.leadSuggestion ? 'lead' : 'client'
  const [track, setTrack] = useState<Track>(initialTrack)
  const [selectedClientId, setSelectedClientId] = useState<string>(thread.clientSuggestion?.clientId ?? '')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedLeadId, setSelectedLeadId] = useState<string>(thread.leadSuggestion?.leadId ?? '')

  // AI analysis state
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle')
  const [clientSuggestion, setClientSuggestion] = useState<AISuggestion | null>(null)
  const [projectSuggestion, setProjectSuggestion] = useState<AISuggestion | null>(null)
  const [analysisTrack, setAnalysisTrack] = useState<Track | null>(null)
  const [suggestDismiss, setSuggestDismiss] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const filteredProjects = useMemo(() => {
    if (!selectedClientId) return []
    return projects.filter(p => p.clientId === selectedClientId)
  }, [selectedClientId, projects])

  const latestMessage = thread.latestMessage
  const hasValidSelection = track === 'client' ? !!selectedClientId : !!selectedLeadId

  const cancelAnalysis = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setAnalysisState('done')
  }, [])

  const handleAnalyze = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setAnalysisState('analyzing')
    try {
      // Step 1: Get client suggestions via AI
      const clientRes = await fetch(`/api/threads/${thread.id}/suggestions`, {
        signal: controller.signal,
      })
      if (!clientRes.ok) {
        setAnalysisState('error')
        return
      }
      const clientData = await clientRes.json()
      const topClient = clientData.suggestions?.[0] ?? null

      if (topClient) {
        // AI found a client match — set to client track
        setClientSuggestion(topClient)
        setTrack('client')
        setAnalysisTrack('client')
        setSelectedClientId(topClient.clientId)

        // Step 2: Get project suggestions via AI
        const projectRes = await fetch(`/api/threads/${thread.id}/project-suggestions`, {
          signal: controller.signal,
        })
        if (projectRes.ok) {
          const projectData = await projectRes.json()
          const topProject = projectData.suggestions?.[0] ?? null
          if (topProject) {
            setProjectSuggestion(topProject)
            setSelectedProjectId(topProject.projectId)
          }
        }
      } else {
        // No client match — check for lead
        if (thread.leadSuggestion) {
          setTrack('lead')
          setAnalysisTrack('lead')
          setSelectedLeadId(thread.leadSuggestion.leadId)
        } else {
          // No matches at all — suggest dismissal
          setSuggestDismiss(true)
        }
      }

      setAnalysisState('done')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Triage analysis error:', err)
      setAnalysisState('error')
    }
  }, [thread.id, thread.leadSuggestion])

  const handleAccept = async () => {
    if (!hasValidSelection) return
    setIsSubmitting(true)
    try {
      await onAccept(thread.id, {
        ...(track === 'client' ? {
          clientId: selectedClientId,
          projectId: selectedProjectId || undefined,
        } : {
          leadId: selectedLeadId,
        }),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isAnalyzed = analysisState === 'done'

  // Get the active suggestion for the current selection (for confidence display)
  const activeClientConfidence = clientSuggestion && selectedClientId === clientSuggestion.clientId
    ? clientSuggestion : null
  const activeProjectConfidence = projectSuggestion && selectedProjectId === projectSuggestion.projectId
    ? projectSuggestion : null

  return (
    <button
      type='button'
      className='flex w-full cursor-pointer items-start gap-3 border-l-[3px] border-l-sky-400/70 px-4 py-3 text-left transition-colors hover:bg-muted/40 dark:border-l-sky-500/50'
      onClick={() => onViewThread(thread)}
    >
      {/* Checkbox */}
      <div className='flex flex-shrink-0 pt-0.5' onClick={e => e.stopPropagation()}>
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => onToggle((window.event as MouseEvent)?.shiftKey ?? false)}
          className='h-4 w-4'
        />
      </div>

      {/* Two-column layout */}
      <div className='flex min-w-0 flex-1 items-start gap-6'>
        {/* LEFT COLUMN: email info */}
        <div className='min-w-0 flex-1'>
          {/* Row 1: Type badge + sender identity + metadata */}
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

          {/* Row 2: Subject */}
          <p className='text-foreground/90 mt-1 text-[13px] leading-snug'>
            {thread.subject || '(no subject)'}
          </p>

          {/* Row 3: Snippet — 2-line clamp */}
          <p className='text-muted-foreground/70 mt-0.5 line-clamp-2 text-xs leading-relaxed'>
            {latestMessage?.snippet || ''}
          </p>

          {/* Row 4: Badges */}
          <div className='mt-1.5 flex items-center gap-2'>
            {thread.clientSuggestion && (
              <span className='inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400'>
                <Building2 className='h-2.5 w-2.5' />
                {thread.clientSuggestion.clientName}
              </span>
            )}
            {thread.leadSuggestion && !thread.clientSuggestion && (
              <span className='inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400'>
                <UserCircle className='h-2.5 w-2.5' />
                {thread.leadSuggestion.contactName}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: classification controls */}
        <div className='relative flex w-56 flex-shrink-0 flex-col rounded-lg border bg-muted/30 p-2.5' onClick={e => e.stopPropagation()}>
          {/* Analyze overlay — shown when not yet analyzed */}
          {analysisState === 'idle' && (
            <div className='absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/60 backdrop-blur-[2px]'>
              <Button
                size='sm'
                variant='outline'
                className='h-8 gap-1.5 text-xs shadow-sm'
                onClick={handleAnalyze}
              >
                <Sparkles className='h-3.5 w-3.5' />
                Analyze
              </Button>
              <button
                type='button'
                className='text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 hover:underline transition-colors'
                onClick={() => setAnalysisState('done')}
              >
                Classify manually
              </button>
            </div>
          )}

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

          {/* Dismiss suggestion — AI found no matches */}
          {suggestDismiss && analysisState === 'done' && (
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
                onClick={() => setSuggestDismiss(false)}
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
                'flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium transition-all',
                track === 'client'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Building2 className='h-3 w-3' />
              Client
              {isAnalyzed && analysisTrack === 'client' && clientSuggestion && (
                <span className='text-[9px] font-normal opacity-60'>AI</span>
              )}
            </button>
            <button
              type='button'
              onClick={() => setTrack('lead')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium transition-all',
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
          <TooltipProvider delayDuration={200}>
            <div className='mt-2 space-y-1.5'>
              {track === 'client' && (
                <>
                  <div className='relative'>
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
                    {activeClientConfidence && (
                      <div className='absolute top-1 right-7 flex items-center gap-0.5'>
                        <Badge
                          variant={activeClientConfidence.confidence >= 0.8 ? 'default' : 'secondary'}
                          className='h-5 px-1 text-[9px]'
                        >
                          {Math.round(activeClientConfidence.confidence * 100)}%
                        </Badge>
                        {activeClientConfidence.reasoning && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type='button' className='text-muted-foreground hover:text-foreground transition-colors'>
                                <HelpCircle className='h-3 w-3' />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side='left' className='max-w-xs'>
                              <p className='text-xs'>{activeClientConfidence.reasoning}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedClientId && filteredProjects.length > 0 && (
                    <div className='relative'>
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
                      {activeProjectConfidence && (
                        <div className='absolute top-1 right-7 flex items-center gap-0.5'>
                          <Badge
                            variant={activeProjectConfidence.confidence >= 0.8 ? 'default' : 'secondary'}
                            className='h-5 px-1 text-[9px]'
                          >
                            {Math.round(activeProjectConfidence.confidence * 100)}%
                          </Badge>
                          {activeProjectConfidence.reasoning && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type='button' className='text-muted-foreground hover:text-foreground transition-colors'>
                                  <HelpCircle className='h-3 w-3' />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side='left' className='max-w-xs'>
                                <p className='text-xs'>{activeProjectConfidence.reasoning}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
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
          </TooltipProvider>

          {/* Action buttons */}
          <div className='mt-2 flex gap-1.5'>
            <Button
              size='sm'
              className='h-8 flex-1 text-xs'
              onClick={handleAccept}
              disabled={!hasValidSelection || isSubmitting}
            >
              <Check className='h-3 w-3' />
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
      </div>
    </button>
  )
}
