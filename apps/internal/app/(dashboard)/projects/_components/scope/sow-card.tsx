'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, Unlink } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SowStatusCell } from '@/components/scope/sow-status-cell'
import type { SowStatusValue } from '@/lib/scope/sow-status'

import type { SowDisplayData } from '../../actions/sow'
import { SowDocumentRenderer } from './sow-document-renderer'
import { SowSectionList } from './sow-section-list'
import { SowSyncButton } from './sow-sync-button'

type SowCardProps = {
  sow: SowDisplayData
  onUnlink: (sowId: string) => void
  onSynced: () => void
  onStatusChange: (sowId: string, status: SowStatusValue) => Promise<void>
}

export function SowCard({ sow, onUnlink, onSynced, onStatusChange }: SowCardProps) {
  const [expanded, setExpanded] = useState(false)
  const hasRichContent = sow.richContent && sow.richContent.length > 0

  return (
    <div className='bg-card text-card-foreground rounded-lg border'>
      {/* Header — always visible */}
      <div className='flex items-center gap-2 px-3 py-2'>
        <button
          type='button'
          onClick={() => setExpanded(prev => !prev)}
          className='hover:bg-muted flex items-center gap-1.5 rounded p-0.5'
        >
          {expanded ? (
            <ChevronDown className='text-muted-foreground h-4 w-4' />
          ) : (
            <ChevronRight className='text-muted-foreground h-4 w-4' />
          )}
          <span className='text-sm font-medium'>
            {sow.googleDocTitle || 'Untitled SOW'}
          </span>
        </button>

        {sow.currentSnapshot && (
          <Badge variant='secondary' className='text-[10px]'>
            v{sow.currentSnapshot.version}
          </Badge>
        )}

        <SowStatusCell
          sowId={sow.id}
          status={sow.status}
          onStatusChange={onStatusChange}
        />

        <div className='flex-1' />

        <SowSyncButton sowId={sow.id} onSynced={onSynced} />

        <Button variant='ghost' size='icon' className='h-7 w-7' asChild>
          <a
            href={sow.googleDocUrl}
            target='_blank'
            rel='noopener noreferrer'
            title='Open in Google Docs'
          >
            <ExternalLink className='h-3.5 w-3.5' />
          </a>
        </Button>

        <Button
          variant='ghost'
          size='sm'
          onClick={() => onUnlink(sow.id)}
          className='text-muted-foreground hover:text-destructive h-7 px-2 text-xs'
        >
          <Unlink className='mr-1 h-3 w-3' />
          Unlink
        </Button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className='border-border border-t'>
          {hasRichContent ? (
            <div className='bg-white p-6'>
              <SowDocumentRenderer blocks={sow.richContent!} />
            </div>
          ) : sow.sections.length > 0 ? (
            <div className='px-3 py-3'>
              <SowSectionList
                sections={sow.sections}
                currentVersion={sow.currentSnapshot?.version ?? 1}
              />
            </div>
          ) : (
            <div className='px-3 py-3'>
              <p className='text-muted-foreground text-xs'>
                No content available. Try syncing this document.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
