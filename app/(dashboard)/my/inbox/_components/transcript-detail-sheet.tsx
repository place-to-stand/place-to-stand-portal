'use client'

import { useCallback, useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { Building2, Calendar, ExternalLink, FileText, FolderKanban, Loader2, RotateCcw, UserCircle, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import type { TranscriptSummary } from '@/lib/queries/transcripts'

import { ClassifierControls } from './classifier-controls'
import { TranscriptContentRenderer } from './transcript-content-renderer'

type Client = { id: string; name: string; slug?: string | null }
type Project = { id: string; name: string; slug?: string | null; clientId: string | null; type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'; ownerId?: string | null; createdBy?: string | null }
type Lead = { id: string; contactName: string; contactEmail?: string | null }

interface TranscriptDetailSheetProps {
  transcript: TranscriptSummary | null
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  currentUserId: string
  onClassify: (transcriptId: string, linkData: { clientId?: string; projectId?: string; leadId?: string }) => Promise<void>
  onDismiss: (transcriptId: string) => Promise<void>
  onUndoDismiss: (transcriptId: string) => Promise<void>
  onUnlink: (transcriptId: string, unlinkData: { clientId?: null; projectId?: null; leadId?: null }) => Promise<void>
  onClose: () => void
}

export function TranscriptDetailSheet({
  transcript,
  clients,
  projects,
  leads,
  currentUserId,
  onClassify,
  onDismiss,
  onUndoDismiss,
  onUnlink,
  onClose,
}: TranscriptDetailSheetProps) {
  const [content, setContent] = useState<string | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [loadedTranscriptId, setLoadedTranscriptId] = useState<string | null>(null)
  const transcriptId = transcript?.id ?? null

  const loadContent = useCallback(async (id: string) => {
    setIsLoadingContent(true)
    setContent(null)
    setLoadedTranscriptId(id)
    try {
      const res = await fetch(`/api/transcripts/${id}`)
      if (res.ok) {
        const data = await res.json()
        setContent(data?.transcript?.content ?? null)
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingContent(false)
    }
  }, [])

  // Load content on open (imperative, not effect — satisfies React Compiler)
  if (transcriptId && transcriptId !== loadedTranscriptId) {
    loadContent(transcriptId)
  }

  const handleAnalyze = useCallback(async () => {
    if (!transcriptId) return null
    const res = await fetch(`/api/transcripts/${transcriptId}/analyze`, { method: 'POST' })
    if (!res.ok) throw new Error('Analysis failed')
    const data = await res.json()
    return data.suggestion ?? null
  }, [transcriptId])

  const handleAccept = useCallback(async (linkData: { clientId?: string; projectId?: string; leadId?: string }) => {
    if (!transcriptId) return
    await onClassify(transcriptId, linkData)
  }, [transcriptId, onClassify])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleDismiss = useCallback(async () => {
    if (!transcriptId) return
    await onDismiss(transcriptId)
  }, [transcriptId, onDismiss])

  const handleUndoDismiss = useCallback(async () => {
    if (!transcriptId) return
    setIsSubmitting(true)
    try {
      await onUndoDismiss(transcriptId)
    } finally {
      setIsSubmitting(false)
    }
  }, [transcriptId, onUndoDismiss])

  const handleUnlinkClient = useCallback(async () => {
    if (!transcriptId) return
    setIsSubmitting(true)
    try {
      await onUnlink(transcriptId, { clientId: null, projectId: null })
    } finally {
      setIsSubmitting(false)
    }
  }, [transcriptId, onUnlink])

  const handleUnlinkProject = useCallback(async () => {
    if (!transcriptId) return
    setIsSubmitting(true)
    try {
      await onUnlink(transcriptId, { projectId: null })
    } finally {
      setIsSubmitting(false)
    }
  }, [transcriptId, onUnlink])

  const handleUnlinkLead = useCallback(async () => {
    if (!transcriptId) return
    setIsSubmitting(true)
    try {
      await onUnlink(transcriptId, { leadId: null })
    } finally {
      setIsSubmitting(false)
    }
  }, [transcriptId, onUnlink])

  const isUnclassified = transcript?.classification === 'UNCLASSIFIED'
  const isClassified = transcript?.classification === 'CLASSIFIED'
  const isDismissed = transcript?.classification === 'DISMISSED'

  // Resolve linked entity names from IDs for classified display
  const linkedClient = transcript?.clientId ? clients.find(c => c.id === transcript.clientId) : null
  const linkedProject = transcript?.projectId ? projects.find(p => p.id === transcript.projectId) : null
  const linkedLead = transcript?.leadId ? leads.find(l => l.id === transcript.leadId) : null

  return (
    <Sheet
      open={!!transcript}
      onOpenChange={open => !open && onClose()}
    >
      <SheetContent
        className='flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-6xl'
        onOpenAutoFocus={e => e.preventDefault()}
      >
        {/* Header */}
        <div className='bg-muted/50 flex-shrink-0 border-b-2 px-6 pt-4 pb-3'>
          <div className='flex items-start justify-between gap-4'>
            <div className='min-w-0 flex-1 pr-10'>
              <SheetTitle className='line-clamp-2 text-lg'>
                {transcript?.title || 'Transcript'}
              </SheetTitle>
              <SheetDescription className='mt-1'>
                {transcript?.meetingDate && (
                  <>{format(new Date(transcript.meetingDate), 'PPP')}</>
                )}
              </SheetDescription>
            </div>
          </div>
        </div>

        {/* Two Column Content */}
        <div className='flex min-h-0 flex-1'>
          {/* Left Column - Transcript Content */}
          <div className='flex-1 overflow-y-auto border-r'>
            <div className='p-6'>
              {isLoadingContent ? (
                <div className='flex flex-col items-center justify-center gap-2 py-16'>
                  <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
                  <span className='text-muted-foreground text-sm'>Loading transcript...</span>
                </div>
              ) : content ? (
                <TranscriptContentRenderer content={content} />
              ) : (
                <div className='flex flex-col items-center justify-center gap-3 py-16'>
                  <FileText className='text-muted-foreground h-8 w-8' />
                  <p className='text-muted-foreground text-sm'>No content available</p>
                  {transcript?.driveFileUrl && (
                    <Button variant='outline' size='sm' asChild>
                      <a
                        href={transcript.driveFileUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        <ExternalLink className='mr-1.5 h-3.5 w-3.5' />
                        View in Google Docs
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Metadata & Classification */}
          <div className='bg-muted/20 w-80 flex-shrink-0 overflow-y-auto lg:w-96'>
            <div className='space-y-6 p-6'>
              {/* Metadata */}
              <div className='space-y-3'>
                <div className='flex items-center gap-2'>
                  <FileText className='text-muted-foreground h-4 w-4' />
                  <span className='text-sm font-medium'>Details</span>
                </div>
                <div className='space-y-2.5 text-sm'>
                  {transcript?.meetingDate && (
                    <div className='flex items-center gap-2.5 text-muted-foreground'>
                      <Calendar className='h-3.5 w-3.5 flex-shrink-0' />
                      <span>{format(new Date(transcript.meetingDate), 'PPp')}</span>
                    </div>
                  )}
                </div>
                {transcript?.driveFileUrl && (
                  <a
                    href={transcript.driveFileUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-primary mt-1 inline-flex items-center gap-1.5 text-sm hover:underline'
                  >
                    <ExternalLink className='h-3.5 w-3.5' />
                    Open in Google Docs
                  </a>
                )}
              </div>

              {/* Classification */}
              {transcript && (
                <>
                  <Separator />
                  <div className='space-y-3'>
                    <div className='flex items-center gap-2'>
                      <Building2 className='text-muted-foreground h-4 w-4' />
                      <span className='text-sm font-medium'>Classification</span>
                    </div>

                    {/* Linked state — show current links with unlink buttons */}
                    {isClassified && (linkedClient || linkedProject || linkedLead) && (
                      <div className='space-y-2'>
                        {linkedClient && (
                          <div className='bg-muted/30 flex items-center justify-between rounded-lg border p-2'>
                            <div className='flex min-w-0 items-center gap-2'>
                              <Building2 className='h-4 w-4 shrink-0 text-blue-500' />
                              {linkedClient.slug ? (
                                <Link
                                  href={`/clients/${linkedClient.slug}`}
                                  className='hover:text-primary truncate text-sm font-medium underline-offset-4 hover:underline'
                                >
                                  {linkedClient.name}
                                </Link>
                              ) : (
                                <span className='truncate text-sm font-medium'>{linkedClient.name}</span>
                              )}
                              <Badge variant='secondary' className='shrink-0 text-xs'>Client</Badge>
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
                        {linkedProject && (
                          <div className='bg-muted/30 flex items-center justify-between rounded-lg border p-2'>
                            <div className='flex min-w-0 items-center gap-2'>
                              <FolderKanban className='h-4 w-4 shrink-0 text-green-500' />
                              {(() => {
                                const clientSlug = linkedProject.clientId
                                  ? clients.find(c => c.id === linkedProject.clientId)?.slug
                                  : null
                                const segment = clientSlug
                                  ?? (linkedProject.type === 'INTERNAL' ? 'internal' : linkedProject.type === 'PERSONAL' ? 'personal' : null)
                                return segment && linkedProject.slug ? (
                                  <Link
                                    href={`/projects/${segment}/${linkedProject.slug}/board`}
                                    className='hover:text-primary truncate text-sm font-medium underline-offset-4 hover:underline'
                                  >
                                    {linkedProject.name}
                                  </Link>
                                ) : (
                                  <span className='truncate text-sm font-medium'>{linkedProject.name}</span>
                                )
                              })()}
                              <Badge variant='secondary' className='shrink-0 text-xs'>Project</Badge>
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
                        {linkedLead && (
                          <div className='bg-muted/30 flex items-center justify-between rounded-lg border p-2'>
                            <div className='flex min-w-0 items-center gap-2'>
                              <UserCircle className='h-4 w-4 shrink-0 text-orange-500' />
                              <Link
                                href={`/leads/board/${linkedLead.id}`}
                                className='hover:text-primary truncate text-sm font-medium underline-offset-4 hover:underline'
                              >
                                {linkedLead.contactName}
                              </Link>
                              <Badge variant='secondary' className='shrink-0 text-xs'>Lead</Badge>
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

                    {/* Dismissed state — with undo */}
                    {isDismissed && (
                      <div className='rounded-lg border bg-muted/30 p-3'>
                        <div className='flex items-center justify-between'>
                          <Badge variant='secondary' className='text-xs'>Dismissed</Badge>
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

                    {/* Unclassified — show classifier controls */}
                    {isUnclassified && (
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
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
