'use client'

import { ExternalLink, FileText } from 'lucide-react'
import { format } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import type { TranscriptForClient } from '@/lib/queries/transcripts'

type Props = {
  transcripts: TranscriptForClient[]
  totalCount: number
}

export function ClientTranscriptsSection({ transcripts, totalCount }: Props) {
  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-3 border-b px-4 py-3'>
        <div className='bg-muted flex h-7 w-7 items-center justify-center rounded-md'>
          <FileText className='text-muted-foreground h-4 w-4' />
        </div>
        <h2 className='font-semibold'>Transcripts</h2>
        <Badge variant='secondary' className='ml-auto'>
          {totalCount}
        </Badge>
      </div>

      <div className='p-3'>
        {transcripts.length === 0 ? (
          <div className='text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm'>
            No transcripts linked yet.
          </div>
        ) : (
          <div className='divide-y'>
            {transcripts.map(t => (
              <TranscriptRow key={t.id} transcript={t} />
            ))}
            {totalCount > transcripts.length && (
              <div className='px-3 py-2 text-center'>
                <span className='text-muted-foreground text-xs'>
                  +{totalCount - transcripts.length} more
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function TranscriptRow({ transcript }: { transcript: TranscriptForClient }) {
  const content = (
    <>
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium'>
          {transcript.title}
        </div>
        {transcript.meetingDate && (
          <div className='text-muted-foreground mt-0.5 text-xs'>
            {format(new Date(transcript.meetingDate), 'MMM d, yyyy')}
          </div>
        )}
      </div>
      {transcript.driveFileUrl && (
        <a
          href={transcript.driveFileUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='text-muted-foreground hover:text-primary shrink-0'
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className='h-3.5 w-3.5' />
        </a>
      )}
    </>
  )

  return (
    <div className='flex items-center gap-3 px-3 py-2.5'>
      {content}
    </div>
  )
}
