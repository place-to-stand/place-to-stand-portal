'use client'

import { useState, useMemo, useCallback } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  FolderKanban,
  Loader2,
  Sparkles,
  UserCircle,
  Users,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import type { TranscriptSummary } from '@/lib/queries/transcripts'

type Client = { id: string; name: string }
type Project = { id: string; name: string; clientId: string | null }
type Lead = { id: string; contactName: string }

type Track = 'client' | 'internal' | 'lead'

interface TranscriptRowProps {
  transcript: TranscriptSummary
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  isChecked: boolean
  shouldAnalyze?: boolean
  onAnalyzeStarted?: () => void
  onToggle: (shiftKey: boolean) => void
  onAccept: (transcriptId: string, linkData: { clientId?: string; projectId?: string; leadId?: string }) => Promise<void>
  onDismiss: (transcriptId: string) => Promise<void>
  onExpand: (transcriptId: string) => void
  isExpanded: boolean
  expandedContent: string | null
  isLoadingContent: boolean
}

export function TranscriptRow({
  transcript,
  clients,
  projects,
  leads,
  isChecked,
  shouldAnalyze,
  onAnalyzeStarted,
  onToggle,
  onAccept,
  onDismiss,
  onExpand,
  isExpanded,
  expandedContent,
  isLoadingContent,
}: TranscriptRowProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Determine initial track from AI suggestions
  const initialTrack: Track = transcript.aiSuggestedClientId
    ? 'client'
    : transcript.aiSuggestedLeadId
      ? 'lead'
      : 'client'

  const [track, setTrack] = useState<Track>(initialTrack)
  const [selectedClientId, setSelectedClientId] = useState<string>(transcript.aiSuggestedClientId ?? '')
  const [selectedProjectId, setSelectedProjectId] = useState<string>(transcript.aiSuggestedProjectId ?? '')
  const [selectedLeadId, setSelectedLeadId] = useState<string>(transcript.aiSuggestedLeadId ?? '')
  const [selectedInternalProjectId, setSelectedInternalProjectId] = useState<string>('')

  // AI analysis state for re-analyze
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const filteredProjects = useMemo(() => {
    if (!selectedClientId) return []
    return projects.filter(p => p.clientId === selectedClientId)
  }, [selectedClientId, projects])

  const internalProjectGroups = useMemo(() => {
    const internal = projects.filter(p => !('clientId' in p && p.clientId))
    return { internal }
  }, [projects])

  const hasValidSelection =
    track === 'client' ? !!selectedClientId
    : track === 'internal' ? !!selectedInternalProjectId
    : !!selectedLeadId

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true)
    onAnalyzeStarted?.()
    try {
      const res = await fetch(`/api/transcripts/${transcript.id}/analyze`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        const suggestion = data.suggestion
        if (suggestion?.clientId) {
          setTrack('client')
          setSelectedClientId(suggestion.clientId)
          if (suggestion.projectId) setSelectedProjectId(suggestion.projectId)
        } else if (suggestion?.leadId) {
          setTrack('lead')
          setSelectedLeadId(suggestion.leadId)
        }
      }
    } catch (err) {
      console.error('Transcript analysis error:', err)
    } finally {
      setIsAnalyzing(false)
    }
  }, [transcript.id, onAnalyzeStarted])

  // Batch analyze trigger
  if (shouldAnalyze && !isAnalyzing && !transcript.aiAnalyzedAt) {
    handleAnalyze()
  }

  const handleAccept = async () => {
    if (!hasValidSelection) return
    setIsSubmitting(true)
    try {
      await onAccept(transcript.id, {
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

  const handleDismiss = async () => {
    setIsSubmitting(true)
    try {
      await onDismiss(transcript.id)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isUnclassified = transcript.classification === 'UNCLASSIFIED'
  const hasAiSuggestion = !!transcript.aiAnalyzedAt && (!!transcript.aiSuggestedClientId || !!transcript.aiSuggestedLeadId)

  return (
    <div className='border-b last:border-b-0'>
      {/* Main row */}
      <div className='flex w-full items-start gap-3 px-4 py-3'>
        {/* Checkbox */}
        {isUnclassified && (
          <div className='-m-2 flex flex-shrink-0 p-2 pt-2.5' onClick={e => { e.stopPropagation(); onToggle(e.shiftKey) }}>
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => {}}
              className='h-4 w-4'
            />
          </div>
        )}

        {/* Two-column layout */}
        <div className='flex min-w-0 flex-1 items-start gap-6'>
          {/* LEFT COLUMN: transcript info */}
          <div
            className='min-w-0 flex-1 cursor-pointer'
            role='button'
            tabIndex={0}
            onClick={() => onExpand(transcript.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand(transcript.id) } }}
          >
            {/* Row 1: Type badge + title + date */}
            <div className='flex items-center gap-2'>
              <span className='inline-flex flex-shrink-0 items-center gap-1 rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'>
                <FileText className='h-3 w-3' />
                Transcript
              </span>
              <span className='truncate text-sm font-semibold tracking-tight'>
                {transcript.title}
              </span>
              {isExpanded ? (
                <ChevronDown className='text-muted-foreground ml-1 h-3.5 w-3.5 flex-shrink-0' />
              ) : (
                <ChevronRight className='text-muted-foreground ml-1 h-3.5 w-3.5 flex-shrink-0' />
              )}
              <span className='text-muted-foreground/50 ml-auto flex-shrink-0 text-[11px] tabular-nums'>
                {transcript.meetingDate
                  ? formatDistanceToNow(new Date(transcript.meetingDate), { addSuffix: true })
                  : 'Date unknown'}
              </span>
            </div>

            {/* Row 2: Participants */}
            {transcript.participantNames.length > 0 && (
              <p className='text-muted-foreground/70 mt-0.5 flex items-center gap-1 text-xs'>
                <Users className='h-3 w-3 flex-shrink-0' />
                <span className='truncate'>
                  {transcript.participantNames.slice(0, 5).join(', ')}
                  {transcript.participantNames.length > 5 && ` +${transcript.participantNames.length - 5} more`}
                </span>
              </p>
            )}

            {/* Row 3: AI suggestion badge */}
            <div className='mt-1.5 flex items-center gap-2'>
              {hasAiSuggestion && transcript.aiSuggestedClientId && (
                <span className='inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400'>
                  <Sparkles className='h-2.5 w-2.5' />
                  {transcript.aiSuggestedClientName}
                  {transcript.aiSuggestedProjectName && ` → ${transcript.aiSuggestedProjectName}`}
                  {transcript.aiConfidence && ` (${Math.round(parseFloat(transcript.aiConfidence) * 100)}%)`}
                </span>
              )}
              {hasAiSuggestion && !transcript.aiSuggestedClientId && transcript.aiSuggestedLeadId && (
                <span className='inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400'>
                  <Sparkles className='h-2.5 w-2.5' />
                  Lead → {transcript.aiSuggestedLeadName}
                  {transcript.aiConfidence && ` (${Math.round(parseFloat(transcript.aiConfidence) * 100)}%)`}
                </span>
              )}
              {transcript.durationMinutes && (
                <span className='text-muted-foreground/50 inline-flex items-center gap-1 text-[10px]'>
                  <Clock className='h-2.5 w-2.5' />
                  {transcript.durationMinutes}m
                </span>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: classification controls (unclassified only) */}
          {isUnclassified && (
            <div className='relative flex w-72 flex-shrink-0 flex-col rounded-lg border bg-muted/30 p-2.5'>
              {/* Analyze overlay — shown when not yet analyzed */}
              {!transcript.aiAnalyzedAt && !isAnalyzing && (
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
                    className='text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 transition-colors hover:underline'
                    onClick={() => {/* skip analysis, controls shown underneath */}}
                  >
                    Classify manually
                  </button>
                </div>
              )}

              {/* Analyzing spinner overlay */}
              {isAnalyzing && (
                <div className='absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/60 backdrop-blur-[2px]'>
                  <div className='flex items-center gap-2 text-xs'>
                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                    Analyzing...
                  </div>
                </div>
              )}

              {/* Segmented track toggle */}
              <div className='flex rounded-md bg-muted/60 p-0.5'>
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
                          <SelectLabel>Internal / Personal</SelectLabel>
                          {internalProjectGroups.internal.map(p => (
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
                  onClick={handleDismiss}
                  disabled={isSubmitting}
                >
                  <XCircle className='h-3 w-3' />
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Classified state — show linked entity */}
          {transcript.classification === 'CLASSIFIED' && (
            <div className='flex flex-shrink-0 items-center gap-2'>
              {transcript.clientId && (
                <span className='inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-500'>
                  <Building2 className='h-3 w-3' />
                  {clients.find(c => c.id === transcript.clientId)?.name ?? 'Client'}
                </span>
              )}
              {transcript.leadId && (
                <span className='inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-500'>
                  <UserCircle className='h-3 w-3' />
                  {leads.find(l => l.id === transcript.leadId)?.contactName ?? 'Lead'}
                </span>
              )}
            </div>
          )}

          {/* Dismissed state */}
          {transcript.classification === 'DISMISSED' && (
            <span className='text-muted-foreground flex-shrink-0 text-xs'>Dismissed</span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className='border-t bg-muted/20 px-4 py-4'>
          {isLoadingContent ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
            </div>
          ) : (
            <div className='space-y-3'>
              {/* Metadata */}
              <div className='flex flex-wrap items-center gap-4 text-xs text-muted-foreground'>
                {transcript.meetingDate && (
                  <span className='flex items-center gap-1'>
                    <Clock className='h-3 w-3' />
                    {format(new Date(transcript.meetingDate), 'PPP')}
                  </span>
                )}
                {transcript.durationMinutes && (
                  <span>{transcript.durationMinutes} minutes</span>
                )}
                {transcript.driveFileUrl && (
                  <a
                    href={transcript.driveFileUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 text-primary hover:underline'
                  >
                    <ExternalLink className='h-3 w-3' />
                    Open in Google Docs
                  </a>
                )}
              </div>

              {/* Content */}
              {expandedContent ? (
                <pre className='max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-background p-4 text-xs leading-relaxed'>
                  {expandedContent}
                </pre>
              ) : (
                <p className='text-muted-foreground text-sm'>No content available.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
