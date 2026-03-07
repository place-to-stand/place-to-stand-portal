'use client'

import { ExternalLink, FileText, Loader2, Users } from 'lucide-react'
import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'

type TranscriptForLead = {
  id: string
  title: string
  meetingDate: string | null
  durationMinutes: number | null
  participantNames: string[]
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
            <div
              key={t.id}
              className='rounded-md border bg-muted/30 px-3 py-2'
            >
              <div className='flex items-start justify-between gap-2'>
                <span className='text-sm font-medium leading-snug'>
                  {t.title}
                </span>
                {t.driveFileUrl && (
                  <a
                    href={t.driveFileUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-muted-foreground hover:text-primary mt-0.5 shrink-0'
                  >
                    <ExternalLink className='h-3.5 w-3.5' />
                  </a>
                )}
              </div>
              <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs'>
                {t.meetingDate && (
                  <span>{format(new Date(t.meetingDate), 'MMM d, yyyy')}</span>
                )}
                {t.durationMinutes && (
                  <span>{t.durationMinutes}m</span>
                )}
                {t.participantNames.length > 0 && (
                  <span className='flex items-center gap-1'>
                    <Users className='h-3 w-3' />
                    {t.participantNames.slice(0, 3).join(', ')}
                    {t.participantNames.length > 3 && ` +${t.participantNames.length - 3}`}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
