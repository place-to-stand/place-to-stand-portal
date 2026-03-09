'use client'

import { useCallback, useState } from 'react'
import { Calendar, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { TranscriptHtmlRenderer } from '@/app/(dashboard)/my/communications/_components/transcript-html-renderer'
import { TranscriptContentRenderer } from '@/app/(dashboard)/my/communications/_components/transcript-content-renderer'

type TranscriptForLead = {
  id: string
  title: string
  meetingDate: string | null
  driveFileUrl: string | null
}

type LeadTranscriptsSectionProps = {
  leadId: string | undefined
}

async function fetchLeadTranscripts(leadId: string): Promise<TranscriptForLead[]> {
  const res = await fetch(`/api/leads/${leadId}/transcripts`)
  if (!res.ok) throw new Error('Failed to load transcripts')
  const data = await res.json()
  return data.transcripts ?? []
}

export function LeadTranscriptsSection({ leadId }: LeadTranscriptsSectionProps) {
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptForLead | null>(null)

  const {
    data: transcripts = [],
    isLoading,
  } = useQuery({
    queryKey: ['lead-transcripts', leadId],
    queryFn: () => fetchLeadTranscripts(leadId!),
    enabled: !!leadId,
  })

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <FileText className='text-muted-foreground h-4 w-4' />
        <span className='text-sm font-medium'>Transcripts</span>
        {transcripts.length > 0 && (
          <Badge variant='secondary' className='ml-auto text-xs'>
            {transcripts.length}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className='flex items-center justify-center py-4'>
          <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
        </div>
      ) : transcripts.length === 0 ? (
        <p className='text-muted-foreground text-xs'>
          No transcripts linked to this lead.
        </p>
      ) : (
        <div className='space-y-1'>
          {transcripts.map(t => (
            <button
              key={t.id}
              type="button"
              className='w-full rounded-md border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/50'
              onClick={() => setSelectedTranscript(t)}
            >
              <span className='text-sm font-medium leading-snug'>
                {t.title}
              </span>
              {t.meetingDate && (
                <div className='text-muted-foreground mt-1 text-xs'>
                  {format(new Date(t.meetingDate), 'MMM d, yyyy')}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <TranscriptDetailSheet
        transcript={selectedTranscript}
        onClose={() => setSelectedTranscript(null)}
      />
    </div>
  )
}

function TranscriptDetailSheet({
  transcript,
  onClose,
}: {
  transcript: TranscriptForLead | null
  onClose: () => void
}) {
  const [content, setContent] = useState<string | null>(null)
  const [contentHtml, setContentHtml] = useState<string | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [loadedId, setLoadedId] = useState<string | null>(null)

  const loadContent = useCallback(async (id: string) => {
    setIsLoadingContent(true)
    setContent(null)
    setContentHtml(null)
    setLoadedId(id)
    try {
      const res = await fetch(`/api/transcripts/${id}`)
      if (res.ok) {
        const data = await res.json()
        setContent(data?.transcript?.content ?? null)
        setContentHtml(data?.transcript?.contentHtml ?? null)
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingContent(false)
    }
  }, [])

  const transcriptId = transcript?.id ?? null
  if (transcriptId && transcriptId !== loadedId) {
    loadContent(transcriptId)
  }

  return (
    <Sheet open={!!transcript} onOpenChange={open => !open && onClose()}>
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
              ) : contentHtml ? (
                <TranscriptHtmlRenderer html={contentHtml} />
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

          {/* Right Column - Metadata */}
          <div className='bg-muted/20 w-80 flex-shrink-0 overflow-y-auto lg:w-96'>
            <div className='space-y-6 p-6'>
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
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
