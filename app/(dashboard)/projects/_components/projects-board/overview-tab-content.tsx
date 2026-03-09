'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ExternalLink,
  FileText,
  Info,
  Loader2,
  Mail,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { TabsContent } from '@/components/ui/tabs'
import { getProjectStatusLabel, getProjectStatusToken } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { ProjectsBoardEmpty } from '../projects-board-empty'
import {
  NO_SELECTION_DESCRIPTION,
  NO_SELECTION_TITLE,
} from './projects-board-tabs.constants'
import type { ProjectsBoardActiveProject } from './board-tab-content'

export type OverviewTabContentProps = {
  isActive: boolean
  activeProject: ProjectsBoardActiveProject
}

type OverviewThread = {
  id: string
  subject: string | null
  lastMessageAt: string | null
  messageCount: number
  participantEmails: string[]
}

type OverviewTranscript = {
  id: string
  title: string
  meetingDate: string | null
  driveFileUrl: string | null
}

type OverviewData = {
  threads: OverviewThread[]
  transcripts: OverviewTranscript[]
  transcriptCount: number
}

function useProjectOverview(projectId: string | null) {
  return useQuery<OverviewData>({
    queryKey: ['project-overview', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/overview`)
      if (!res.ok) {
        throw new Error('Failed to load project overview')
      }
      const json = await res.json()
      return json.data as OverviewData
    },
    staleTime: 30_000,
  })
}

export function OverviewTabContent(props: OverviewTabContentProps) {
  const { isActive, activeProject } = props
  const { data, isLoading, isError } = useProjectOverview(
    isActive && activeProject ? activeProject.id : null
  )

  if (!isActive) {
    return null
  }

  return (
    <TabsContent
      value='overview'
      className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'
    >
      {!activeProject ? (
        <ProjectsBoardEmpty
          title={NO_SELECTION_TITLE}
          description={NO_SELECTION_DESCRIPTION}
        />
      ) : (
        <div className='grid gap-4 lg:grid-cols-2'>
          {/* Left column: Project Details */}
          <div className='space-y-4'>
            <ProjectDetailsWidget project={activeProject} />
          </div>

          {/* Right column: Emails & Transcripts */}
          <div className='space-y-4'>
            <EmailsSection
              threads={data?.threads ?? []}
              isLoading={isLoading}
              isError={isError}
              projectId={activeProject.id}
            />
            <TranscriptsSection
              transcripts={data?.transcripts ?? []}
              totalCount={data?.transcriptCount ?? 0}
              isLoading={isLoading}
              isError={isError}
              projectId={activeProject.id}
            />
          </div>
        </div>
      )}
    </TabsContent>
  )
}

function ProjectDetailsWidget({
  project,
}: {
  project: NonNullable<ProjectsBoardActiveProject>
}) {
  const statusLabel = getProjectStatusLabel(project.status)
  const statusToken = getProjectStatusToken(project.status)

  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-3 border-b px-4 py-3'>
        <div className='flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10'>
          <Info className='h-4 w-4 text-emerald-500' />
        </div>
        <h2 className='font-semibold'>Project Details</h2>
      </div>
      <div className='divide-y'>
        <div className='flex items-center gap-3 px-4 py-2.5'>
          <span className='text-muted-foreground text-sm'>Status</span>
          <Badge className={cn('ml-auto text-[10px]', statusToken)}>
            {statusLabel}
          </Badge>
        </div>
        {project.client?.name && (
          <div className='flex items-center gap-3 px-4 py-2.5'>
            <span className='text-muted-foreground text-sm'>Client</span>
            <span className='ml-auto text-sm font-medium'>
              {project.client.name}
            </span>
          </div>
        )}
        {project.burndown && (
          <>
            <div className='flex items-center gap-3 px-4 py-2.5'>
              <span className='text-muted-foreground text-sm'>
                Hours logged
              </span>
              <span className='ml-auto text-sm font-medium'>
                {project.burndown.totalProjectLoggedHours.toFixed(1)}h
              </span>
            </div>
            {project.burndown.totalClientRemainingHours > 0 && (
              <div className='flex items-center gap-3 px-4 py-2.5'>
                <span className='text-muted-foreground text-sm'>
                  Client hours remaining
                </span>
                <span className='ml-auto text-sm font-medium'>
                  {project.burndown.totalClientRemainingHours.toFixed(1)}h
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function EmailsSection({
  threads,
  isLoading,
  isError,
  projectId,
}: {
  threads: OverviewThread[]
  isLoading: boolean
  isError: boolean
  projectId: string
}) {
  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-3 border-b px-4 py-3'>
        <div className='bg-muted flex h-7 w-7 items-center justify-center rounded-md'>
          <Mail className='text-muted-foreground h-4 w-4' />
        </div>
        <h2 className='font-semibold'>Messages</h2>
        <Badge variant='secondary' className='ml-auto'>
          {threads.length}
        </Badge>
      </div>
      <div className='p-3'>
        {isLoading ? (
          <div className='text-muted-foreground flex items-center gap-2 px-3 py-4 text-sm'>
            <Loader2 className='h-4 w-4 animate-spin' /> Loading…
          </div>
        ) : isError ? (
          <div className='text-muted-foreground px-3 py-4 text-center text-sm'>
            Unable to load messages.
          </div>
        ) : threads.length === 0 ? (
          <div className='text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm'>
            No messages classified to this project yet.
          </div>
        ) : (
          <div className='divide-y'>
            {threads.map(thread => (
              <Link
                key={thread.id}
                href={`/my/inbox/emails?thread=${thread.id}`}
                className='hover:bg-muted/50 flex items-center gap-3 px-3 py-2.5 transition'
              >
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-sm font-medium'>
                    {thread.subject || '(no subject)'}
                  </div>
                  <div className='text-muted-foreground mt-0.5 flex items-center gap-2 text-xs'>
                    <span className='truncate'>
                      {thread.participantEmails[0] ?? 'Unknown'}
                    </span>
                    {thread.lastMessageAt && (
                      <>
                        <span className='shrink-0'>·</span>
                        <span className='shrink-0'>
                          {formatDistanceToNow(
                            new Date(thread.lastMessageAt),
                            { addSuffix: true }
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            {threads.length >= 10 && (
              <div className='px-3 py-2 text-center'>
                <Link
                  href={`/my/inbox/emails?project=${projectId}`}
                  className='text-muted-foreground hover:text-foreground text-xs transition'
                >
                  View all in inbox
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function TranscriptsSection({
  transcripts,
  totalCount,
  isLoading,
  isError,
  projectId,
}: {
  transcripts: OverviewTranscript[]
  totalCount: number
  isLoading: boolean
  isError: boolean
  projectId: string
}) {
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
        {isLoading ? (
          <div className='text-muted-foreground flex items-center gap-2 px-3 py-4 text-sm'>
            <Loader2 className='h-4 w-4 animate-spin' /> Loading…
          </div>
        ) : isError ? (
          <div className='text-muted-foreground px-3 py-4 text-center text-sm'>
            Unable to load transcripts.
          </div>
        ) : transcripts.length === 0 ? (
          <div className='text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm'>
            No transcripts classified to this project yet.
          </div>
        ) : (
          <div className='divide-y'>
            {transcripts.map(t => (
              <Link
                key={t.id}
                href={`/my/inbox/transcripts?transcript=${t.id}`}
                className='hover:bg-muted/50 flex items-center gap-3 px-3 py-2.5 transition'
              >
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-sm font-medium'>{t.title}</div>
                  {t.meetingDate && (
                    <div className='text-muted-foreground mt-0.5 text-xs'>
                      {format(new Date(t.meetingDate), 'MMM d, yyyy')}
                    </div>
                  )}
                </div>
                {t.driveFileUrl && (
                  <span className='text-muted-foreground shrink-0'>
                    <ExternalLink className='h-3.5 w-3.5' />
                  </span>
                )}
              </Link>
            ))}
            {totalCount > transcripts.length && (
              <div className='px-3 py-2 text-center'>
                <Link
                  href={`/my/inbox/transcripts?project=${projectId}`}
                  className='text-muted-foreground hover:text-foreground text-xs transition'
                >
                  +{totalCount - transcripts.length} more
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
