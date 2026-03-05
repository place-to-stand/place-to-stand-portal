'use client'

import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Building2,
  Check,
  FolderKanban,
  Loader2,
  RotateCcw,
  UserCircle,
  UserPlus,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { ThreadSummary, Message } from '@/lib/types/messages'

import { ClassificationBadge } from './classification-badge'
import Link from 'next/link'

import { LeadSheet } from '@/app/(dashboard)/leads/_components/lead-sheet/lead-sheet'

function extractCompanyFromEmail(email: string): string | null {
  const domainMatch = email.match(/@([^.]+)/)
  if (!domainMatch) return null
  const domain = domainMatch[1]
  const providers = ['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'aol', 'proton', 'protonmail']
  if (providers.includes(domain.toLowerCase())) return null
  return domain.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

type Client = { id: string; name: string; slug: string | null }
type Project = {
  id: string
  name: string
  slug: string | null
  clientSlug: string | null
  type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
  ownerId: string | null
  createdBy: string | null
}
type Lead = { id: string; contactName: string }

type AISuggestion = {
  clientId?: string
  clientName?: string
  projectId?: string
  projectName?: string
  confidence: number
  reasoning?: string
  matchType?: string
}

type Track = 'client' | 'internal' | 'lead'
type AnalysisState = 'idle' | 'analyzing' | 'done' | 'error'

interface ThreadClassificationPanelProps {
  thread: ThreadSummary
  threadMessages: Message[]
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  currentUserId: string
  setThreads: Dispatch<SetStateAction<ThreadSummary[]>>
  setSelectedThread: Dispatch<SetStateAction<ThreadSummary | null>>
}

export function ThreadClassificationPanel({
  thread,
  threadMessages,
  clients,
  projects,
  leads,
  currentUserId,
  setThreads,
  setSelectedThread,
}: ThreadClassificationPanelProps) {
  const { toast } = useToast()

  // Track & selection state
  const [track, setTrack] = useState<Track>('client')
  const [selectedClientId, setSelectedClientId] = useState<string>(
    thread.client?.id ?? ''
  )
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    thread.project?.id ?? ''
  )
  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    thread.lead?.id ?? ''
  )

  // AI analysis state
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle')
  const [clientSuggestion, setClientSuggestion] =
    useState<AISuggestion | null>(null)
  const [projectSuggestion, setProjectSuggestion] =
    useState<AISuggestion | null>(null)
  const [analysisTrack, setAnalysisTrack] = useState<Track | null>(null)
  const [suggestDismiss, setSuggestDismiss] = useState(false)

  // Action state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreateLeadOpen, setIsCreateLeadOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // State for internal track
  const [selectedInternalProjectId, setSelectedInternalProjectId] = useState<string>('')

  const filteredProjects = useMemo(() => {
    if (!selectedClientId) return []
    // Match projects by client — check both clientSlug-based and direct clientId
    const client = clients.find(c => c.id === selectedClientId)
    if (!client) return []
    return projects.filter(p => p.clientSlug === client.slug)
  }, [selectedClientId, clients, projects])

  // Internal/personal projects for the internal track (personal filtered to current user)
  const internalProjectGroups = useMemo(() => {
    const internal = projects.filter(p => p.type === 'INTERNAL')
    const personal = projects.filter(p => p.type === 'PERSONAL' && (p.ownerId ?? p.createdBy) === currentUserId)
    return { internal, personal }
  }, [projects, currentUserId])

  // Determine if thread is already classified (has links)
  const isAlreadyClassified =
    !!thread.client || !!thread.project || !!thread.lead
  const hasValidSelection =
    track === 'client' ? !!selectedClientId
    : track === 'internal' ? !!selectedInternalProjectId
    : !!selectedLeadId

  const cancelAnalysis = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setAnalysisState('done')
  }, [])

  // Auto-analyze on mount for unclassified threads
  const handleAnalyze = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setAnalysisState('analyzing')
    try {
      // Single call returns both client and project suggestions
      const res = await fetch(`/api/threads/${thread.id}/suggestions`, {
        signal: controller.signal,
      })
      if (!res.ok) {
        setAnalysisState('error')
        return
      }
      const data = await res.json()
      const topClient = data.suggestions?.[0] ?? null
      const topProject = data.projectSuggestions?.[0] ?? null

      if (topClient) {
        // AI found a client match — set to client track
        setClientSuggestion(topClient)
        setTrack('client')
        setAnalysisTrack('client')
        setSelectedClientId(topClient.clientId)

        if (topProject) {
          setProjectSuggestion(topProject)
          setSelectedProjectId(topProject.projectId)
        }
      } else if (topProject) {
        // No client match but AI matched a project — check if internal/personal and accessible
        const matchedProject = projects.find(p => p.id === topProject.projectId)
        const isAccessibleInternal = matchedProject && (
          matchedProject.type === 'INTERNAL' ||
          (matchedProject.type === 'PERSONAL' && (matchedProject.ownerId ?? matchedProject.createdBy) === currentUserId)
        )
        if (isAccessibleInternal) {
          setProjectSuggestion(topProject)
          setTrack('internal')
          setAnalysisTrack('internal')
          setSelectedInternalProjectId(topProject.projectId)
        } else {
          // Client project matched without a client — fall through to lead/dismiss
          setSuggestDismiss(true)
        }
      } else {
        // No client or project match — check for DB lead suggestion
        const leadRes = await fetch(
          `/api/threads/${thread.id}/lead-suggestions`,
          { signal: controller.signal }
        )
        if (leadRes.ok) {
          const leadData = await leadRes.json()
          const topLead = leadData.suggestions?.[0] ?? null
          if (topLead) {
            setTrack('lead')
            setAnalysisTrack('lead')
            setSelectedLeadId(topLead.leadId)
          } else {
            // No matches at all — suggest dismissal
            setSuggestDismiss(true)
          }
        } else {
          setSuggestDismiss(true)
        }
      }

      setAnalysisState('done')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Classification analysis error:', err)
      setAnalysisState('error')
    }
  }, [thread.id, projects, currentUserId])

  // Auto-start analysis for unclassified threads
  useEffect(() => {
    if (!isAlreadyClassified && thread.classification !== 'DISMISSED') {
      handleAnalyze()
    } else {
      // Already classified — show as done immediately
      setAnalysisState('done')
      // Set track based on existing links
      if (thread.lead && !thread.client) {
        setTrack('lead')
      }
    }
    // Only run on mount (thread.id change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id])

  // Helper to update local thread state after PATCH
  const updateLocalThread = useCallback(
    (updater: (t: ThreadSummary) => ThreadSummary) => {
      setSelectedThread(prev => (prev ? updater(prev) : prev))
      setThreads(prev => prev.map(t => (t.id === thread.id ? updater(t) : t)))
    },
    [thread.id, setSelectedThread, setThreads]
  )

  // PATCH helper
  const patchThread = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/threads/${thread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('PATCH failed')
      return res.json()
    },
    [thread.id]
  )

  // Classify action — links thread to client/project or lead
  const handleClassify = useCallback(async () => {
    if (!hasValidSelection) return
    setIsSubmitting(true)
    try {
      const body =
        track === 'client'
          ? {
              clientId: selectedClientId,
              ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
            }
          : track === 'internal'
            ? { projectId: selectedInternalProjectId }
            : { leadId: selectedLeadId }

      await patchThread(body)

      // Update local state
      if (track === 'client') {
        const client = clients.find(c => c.id === selectedClientId)
        const project = selectedProjectId
          ? projects.find(p => p.id === selectedProjectId)
          : null
        updateLocalThread(t => ({
          ...t,
          classification: 'CLASSIFIED' as const,
          client: client
            ? { id: client.id, name: client.name, slug: client.slug }
            : t.client,
          project: project
            ? {
                id: project.id,
                name: project.name,
                slug: project.slug,
                clientSlug: project.clientSlug,
              }
            : t.project,
        }))
      } else if (track === 'internal') {
        const project = projects.find(p => p.id === selectedInternalProjectId)
        updateLocalThread(t => ({
          ...t,
          classification: 'CLASSIFIED' as const,
          project: project
            ? {
                id: project.id,
                name: project.name,
                slug: project.slug,
                clientSlug: null,
              }
            : t.project,
        }))
      } else {
        const lead = leads.find(l => l.id === selectedLeadId)
        updateLocalThread(t => ({
          ...t,
          classification: 'CLASSIFIED' as const,
          lead: lead
            ? { id: lead.id, contactName: lead.contactName }
            : t.lead,
        }))
      }

      toast({ title: 'Thread classified' })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to classify thread.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    hasValidSelection,
    track,
    selectedClientId,
    selectedProjectId,
    selectedInternalProjectId,
    selectedLeadId,
    patchThread,
    clients,
    projects,
    leads,
    updateLocalThread,
    toast,
  ])

  // Dismiss action
  const handleDismiss = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await patchThread({ classification: 'DISMISSED' })
      updateLocalThread(t => ({
        ...t,
        classification: 'DISMISSED' as const,
        client: null,
        project: null,
        lead: null,
      }))
      toast({ title: 'Thread dismissed' })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to dismiss thread.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [patchThread, updateLocalThread, toast])

  // Undo dismiss — revert to UNCLASSIFIED
  const handleUndoDismiss = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await patchThread({ classification: 'UNCLASSIFIED' })
      updateLocalThread(t => ({
        ...t,
        classification: 'UNCLASSIFIED' as const,
      }))
      toast({ title: 'Dismiss undone' })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to undo dismiss.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [patchThread, updateLocalThread, toast])

  // Unlink actions (for already-classified threads)
  const handleUnlinkClient = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await patchThread({ clientId: null, projectId: null })
      updateLocalThread(t => ({ ...t, client: null, project: null }))
      setSelectedClientId('')
      setSelectedProjectId('')
      toast({ title: 'Client unlinked' })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unlink client.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [patchThread, updateLocalThread, toast])

  const handleUnlinkProject = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await patchThread({ projectId: null })
      updateLocalThread(t => ({ ...t, project: null }))
      setSelectedProjectId('')
      toast({ title: 'Project unlinked' })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unlink project.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [patchThread, updateLocalThread, toast])

  const handleUnlinkLead = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await patchThread({ leadId: null })
      updateLocalThread(t => ({ ...t, lead: null }))
      setSelectedLeadId('')
      toast({ title: 'Lead unlinked' })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to unlink lead.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [patchThread, updateLocalThread, toast])

  // Handle lead creation success — link the new lead
  const handleLeadCreated = useCallback(
    async (leadId: string) => {
      setIsSubmitting(true)
      try {
        await patchThread({ leadId })
        // We don't have the lead name from the dialog, so refresh from list
        const lead = leads.find(l => l.id === leadId)
        updateLocalThread(t => ({
          ...t,
          classification: 'CLASSIFIED' as const,
          lead: lead
            ? { id: lead.id, contactName: lead.contactName }
            : { id: leadId, contactName: 'New Lead' },
        }))
        toast({ title: 'Lead created and linked' })
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to link created lead.',
          variant: 'destructive',
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [patchThread, leads, updateLocalThread, toast]
  )

  // Extract sender info from first inbound message for Create Lead dialog
  const firstInboundMessage = threadMessages.find(m => m.isInbound)
  const senderInfo = firstInboundMessage
    ? {
        email: firstInboundMessage.fromEmail,
        name: firstInboundMessage.fromName,
      }
    : null

  const isAnalyzed = analysisState === 'done'

  return (
    <div className='space-y-3'>
      {/* Section Header */}
      <div className='flex items-center gap-2'>
        <Building2 className='text-muted-foreground h-4 w-4' />
        <span className='text-sm font-medium'>Classification</span>
      </div>

      {/* Linked state display — show current links with unlink buttons */}
      {isAlreadyClassified && (
        <div className='space-y-2'>
          {thread.client && (
            <div className='bg-muted/30 flex items-center justify-between rounded-lg border p-2'>
              <div className='flex min-w-0 items-center gap-2'>
                <Building2 className='h-4 w-4 shrink-0 text-blue-500' />
                {thread.client.slug ? (
                  <Link
                    href={`/clients/${thread.client.slug}`}
                    className='hover:text-primary truncate text-sm font-medium underline-offset-4 hover:underline'
                  >
                    {thread.client.name}
                  </Link>
                ) : (
                  <span className='truncate text-sm font-medium'>
                    {thread.client.name}
                  </span>
                )}
                <Badge variant='secondary' className='shrink-0 text-xs'>
                  Client
                </Badge>
              </div>
              <Button
                variant='ghost'
                size='icon-sm'
                onClick={handleUnlinkClient}
                disabled={isSubmitting}
              >
                <XCircle className='h-4 w-4' />
              </Button>
            </div>
          )}
          {thread.project && (
            <div className='bg-muted/30 flex items-center justify-between rounded-lg border p-2'>
              <div className='flex min-w-0 items-center gap-2'>
                <FolderKanban className='h-4 w-4 shrink-0 text-green-500' />
                {thread.project.clientSlug && thread.project.slug ? (
                  <Link
                    href={`/projects/${thread.project.clientSlug}/${thread.project.slug}/board`}
                    className='hover:text-primary truncate text-sm font-medium underline-offset-4 hover:underline'
                  >
                    {thread.project.name}
                  </Link>
                ) : (
                  <span className='truncate text-sm font-medium'>
                    {thread.project.name}
                  </span>
                )}
                <Badge variant='secondary' className='shrink-0 text-xs'>
                  Project
                </Badge>
              </div>
              <Button
                variant='ghost'
                size='icon-sm'
                onClick={handleUnlinkProject}
                disabled={isSubmitting}
              >
                <XCircle className='h-4 w-4' />
              </Button>
            </div>
          )}
          {thread.lead && (
            <div className='bg-muted/30 flex items-center justify-between rounded-lg border p-2'>
              <div className='flex min-w-0 items-center gap-2'>
                <UserCircle className='h-4 w-4 shrink-0 text-orange-500' />
                <Link
                  href={`/leads/board/${thread.lead.id}`}
                  className='hover:text-primary truncate text-sm font-medium underline-offset-4 hover:underline'
                >
                  {thread.lead.contactName}
                </Link>
                <Badge variant='secondary' className='shrink-0 text-xs'>
                  Lead
                </Badge>
              </div>
              <Button
                variant='ghost'
                size='icon-sm'
                onClick={handleUnlinkLead}
                disabled={isSubmitting}
              >
                <XCircle className='h-4 w-4' />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Dismissed state — show badge with undo + option to reclassify */}
      {thread.classification === 'DISMISSED' && !isAlreadyClassified && (
        <div className='rounded-lg border bg-muted/30 p-3'>
          <div className='flex items-center justify-between'>
            <ClassificationBadge classification='DISMISSED' />
            <Button
              variant='ghost'
              size='sm'
              className='h-7 gap-1 text-xs'
              onClick={handleUndoDismiss}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className='h-3 w-3 animate-spin' />
              ) : (
                <RotateCcw className='h-3 w-3' />
              )}
              Undo
            </Button>
          </div>
        </div>
      )}

      {/* Classification controls — for unclassified threads */}
      {!isAlreadyClassified && thread.classification !== 'DISMISSED' && (
        <div className='relative rounded-lg border bg-muted/30 p-3'>
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
              <span className='text-muted-foreground text-xs'>
                Analysis failed
              </span>
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
          {suggestDismiss && isAnalyzed && (
            <div className='absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/60 backdrop-blur-[2px]'>
              <span className='text-muted-foreground text-xs'>
                No matches found
              </span>
              <Button
                size='sm'
                variant='destructive'
                className='h-8 gap-1 text-xs'
                onClick={handleDismiss}
                disabled={isSubmitting}
              >
                <XCircle className='h-3 w-3' />
                Dismiss
              </Button>
              <button
                type='button'
                className='text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 transition-colors hover:underline'
                onClick={() => setSuggestDismiss(false)}
              >
                Classify manually
              </button>
            </div>
          )}

          {/* Segmented Client/Internal/Lead toggle */}
          <div className='flex rounded-md bg-muted/60 p-0.5'>
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
              onClick={() => setTrack('internal')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium transition-all',
                track === 'internal'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <FolderKanban className='h-3 w-3' />
              Internal
              {isAnalyzed && analysisTrack === 'internal' && projectSuggestion && (
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
          <div className='mt-2 space-y-1.5'>
            {track === 'client' && (
              <>
                <Select
                  value={selectedClientId}
                  onValueChange={id => {
                    setSelectedClientId(id)
                    setSelectedProjectId('')
                  }}
                >
                  <SelectTrigger className='h-8 w-full border-transparent bg-background/60 text-xs shadow-none'>
                    <SelectValue placeholder='Select client...' />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedClientId && filteredProjects.length > 0 && (
                  <Select
                    value={selectedProjectId}
                    onValueChange={setSelectedProjectId}
                  >
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
              <Select
                value={selectedInternalProjectId}
                onValueChange={setSelectedInternalProjectId}
              >
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
              <>
                <Select
                  value={selectedLeadId}
                  onValueChange={setSelectedLeadId}
                >
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

                {/* Create Lead from Email */}
                {!thread.lead && senderInfo && (
                  <Button
                    variant='outline'
                    size='sm'
                    className='w-full gap-2 text-xs'
                    onClick={() => setIsCreateLeadOpen(true)}
                  >
                    <UserPlus className='h-3.5 w-3.5' />
                    Create Lead from Email
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className='mt-2 flex gap-1.5'>
            <Button
              size='sm'
              className='h-8 flex-1 text-xs'
              onClick={handleClassify}
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

      {/* Create Lead Sheet */}
      <LeadSheet
        open={isCreateLeadOpen}
        onOpenChange={setIsCreateLeadOpen}
        lead={null}
        assignees={[]}
        onSuccess={() => {}}
        onCreated={handleLeadCreated}
        initialValues={senderInfo ? {
          contactName: senderInfo.name ?? undefined,
          contactEmail: senderInfo.email,
          companyName: extractCompanyFromEmail(senderInfo.email) ?? undefined,
          notes: thread.subject ? `Initial inquiry: ${thread.subject}` : undefined,
        } : undefined}
      />
    </div>
  )
}
