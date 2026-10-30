'use client'

import { useEffect, useState } from 'react'
import { CheckCircle } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { Skeleton } from '@pts/ui/skeleton'
import { ClientBadge } from '@/components/clients/client-badge'
import {
  CompanyRecordRow,
  ContactRecordRow,
  ProjectRecordRow,
} from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import { formatCalendarDate } from '@pts/ui/dates'
import type { LeadConversionSummary, LeadRecord } from '@/lib/leads/types'
import { projectBoardHref } from '@/lib/sheets/hrefs'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { ENTITY_ICONS } from '@/lib/entity-accents'

const MAX_PROJECTS = 4

type LeadConversionSectionProps = {
  lead: LeadRecord
  canConvert: boolean
  onConvertToClient: () => void
}

/**
 * Sits above Tasks: what a converted lead became (client, contact, projects),
 * or the convert action once a lead is closed won.
 */
export function LeadConversionSection({
  lead,
  canConvert,
  onConvertToClient,
}: LeadConversionSectionProps) {
  if (lead.convertedToClientId) {
    return (
      <ConvertedSummary
        // Keyed so a re-conversion starts from a fresh loading state.
        key={lead.convertedToClientId}
        leadId={lead.id}
        convertedAt={lead.convertedAt}
      />
    )
  }

  if (!canConvert) return null

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <ENTITY_ICONS.client className='text-muted-foreground h-4 w-4' />
          <span className='text-sm font-medium'>Client</span>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={onConvertToClient}
        >
          <ENTITY_ICONS.client className='h-3 w-3' />
          Bill this company
        </Button>
      </div>
      <p className='text-muted-foreground text-sm'>
        Not a client yet: billing is set up on the lead’s company.
      </p>
    </div>
  )
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; summary: LeadConversionSummary | null }
  | { status: 'error' }

function ConvertedSummary({
  leadId,
  convertedAt,
}: {
  leadId: string
  convertedAt: string | null
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    // Promise-chained so every setState runs asynchronously.
    fetch(`/api/leads/${leadId}/conversion`)
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const body = (await response.json()) as {
          data?: LeadConversionSummary | null
        }
        if (!cancelled)
          setState({ status: 'ready', summary: body.data ?? null })
      })
      .catch(error => {
        console.error('Failed to fetch lead conversion:', error)
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [leadId])

  const convertedOn = formatCalendarDate(convertedAt)

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <CheckCircle className='text-success h-4 w-4' />
          <span className='text-sm font-medium'>Converted</span>
        </div>
        {convertedOn && (
          <span className='text-muted-foreground text-xs'>{convertedOn}</span>
        )}
      </div>

      {state.status === 'loading' ? (
        <Skeleton className='h-28 w-full' />
      ) : state.status === 'error' ? (
        <p className='text-muted-foreground text-sm'>
          Couldn&apos;t load what this lead converted into.
        </p>
      ) : state.summary ? (
        <ConvertedRecords summary={state.summary} />
      ) : (
        <p className='text-muted-foreground text-sm'>
          The converted client is no longer available.
        </p>
      )}
    </div>
  )
}

function ConvertedRecords({ summary }: { summary: LeadConversionSummary }) {
  const { client, contact, projects } = summary
  const { open: openSheet } = useSheetParams()
  const clientSegment = client.slug ?? client.id
  const hiddenProjectCount = projects.length - MAX_PROJECTS

  return (
    <div className='space-y-2'>
      <SheetRecordList>
        <CompanyRecordRow
          company={{ id: client.companyId, name: client.name }}
          titleAddon={client.archived ? null : <ClientBadge />}
          openable={!client.archived}
          actions={
            client.archived ? (
              <span className='pr-1.5'>
                <Badge variant='outline'>Archived</Badge>
              </span>
            ) : null
          }
        />
        {contact && <ContactRecordRow contact={contact} />}
        {projects.slice(0, MAX_PROJECTS).map(project => (
          <ProjectRecordRow
            key={project.id}
            project={project}
            href={projectBoardHref(clientSegment, project.slug ?? project.id)}
          />
        ))}
      </SheetRecordList>
      {hiddenProjectCount > 0 && !client.archived && (
        <button
          type='button'
          onClick={() =>
            openSheet('company', client.companyId, { tab: 'projects' })
          }
          className='text-muted-foreground hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 block rounded-sm text-xs outline-none hover:underline focus-visible:ring-[3px]'
        >
          +{hiddenProjectCount} more{' '}
          {hiddenProjectCount === 1 ? 'project' : 'projects'}
        </button>
      )}
    </div>
  )
}
