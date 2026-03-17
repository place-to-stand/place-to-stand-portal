'use client'

import { formatDistanceToNow } from 'date-fns'
import { Building2, FileText, FolderKanban, UserCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TranscriptSummary } from '@/lib/queries/transcripts'

type Client = { id: string; name: string }
type Project = { id: string; name: string }
type Lead = { id: string; contactName: string }

interface TranscriptCompactRowProps {
  transcript: TranscriptSummary
  clients: Client[]
  projects: Project[]
  leads: Lead[]
  isSelected: boolean
  isFirst: boolean
  onClick: () => void
}

export function TranscriptCompactRow({
  transcript,
  clients,
  projects,
  leads,
  isSelected,
  isFirst,
  onClick,
}: TranscriptCompactRowProps) {
  const clientName = transcript.clientId
    ? clients.find(c => c.id === transcript.clientId)?.name
    : null
  const projectName = transcript.projectId
    ? projects.find(p => p.id === transcript.projectId)?.name
    : null
  const leadName = transcript.leadId
    ? leads.find(l => l.id === transcript.leadId)?.contactName
    : null

  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'bg-muted/20 flex w-full cursor-pointer items-center gap-3 p-2.5 text-left transition-colors',
        'hover:bg-muted/60',
        transcript.classification === 'DISMISSED' && 'opacity-60',
        isSelected && 'bg-muted ring-border ring-1 ring-inset',
        !isFirst && 'border-border/50 border-t'
      )}
    >
      {/* Icon */}
      <div className='flex w-4 flex-shrink-0 items-center justify-center'>
        <FileText className='text-muted-foreground h-3.5 w-3.5' />
      </div>

      {/* Center: Title + date */}
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <span className='truncate text-sm font-medium'>
            {transcript.title}
          </span>
          <span className='text-muted-foreground/70 flex-shrink-0 text-xs whitespace-nowrap tabular-nums'>
            {transcript.meetingDate
              ? formatDistanceToNow(new Date(transcript.meetingDate), {
                  addSuffix: true,
                })
              : ''}
          </span>
        </div>
      </div>

      {/* Right: Entity badges — same pattern as email ThreadRow */}
      {clientName && (
        <Badge
          variant='default'
          className='flex-shrink-0 border-0 bg-blue-100 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300'
        >
          <Building2 className='mr-1 h-3 w-3' />
          <span className='max-w-[100px] truncate'>{clientName}</span>
        </Badge>
      )}

      {projectName && (
        <Badge
          variant='default'
          className='flex-shrink-0 border-0 bg-green-100 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900/50 dark:text-green-300'
        >
          <FolderKanban className='mr-1 h-3 w-3' />
          <span className='max-w-[100px] truncate'>{projectName}</span>
        </Badge>
      )}

      {leadName && !clientName && (
        <Badge
          variant='default'
          className='flex-shrink-0 border-0 bg-purple-100 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-900/50 dark:text-purple-300'
        >
          <UserCircle className='mr-1 h-3 w-3' />
          <span className='max-w-[100px] truncate'>{leadName}</span>
        </Badge>
      )}
    </button>
  )
}
