import { isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients, projects, leads } from '@/lib/db/schema'
import {
  listTranscripts,
  getTranscriptCounts,
  getTranscriptTotalCount,
  getTranscriptById,
} from '@/lib/queries/transcripts'
import { TranscriptPanel } from '../../_components/transcript-panel'

const PAGE_SIZE = 25

type ViewType = 'inbox' | 'unclassified' | 'classified' | 'dismissed'

type Props = {
  params: Promise<{ view?: string[] }>
  searchParams: Promise<{
    page?: string
    transcript?: string
    q?: string
    client?: string
    project?: string
    lead?: string
  }>
}

export default async function TranscriptsPage({ params, searchParams }: Props) {
  const user = await requireUser()

  const { view } = await params
  const query = await searchParams

  const validViews: ViewType[] = ['inbox', 'unclassified', 'classified', 'dismissed']
  const currentView: ViewType = validViews.includes(view?.[0] as ViewType)
    ? (view![0] as ViewType)
    : 'inbox'

  const currentPage = Math.max(1, parseInt(query.page || '1', 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE
  const search = query.q?.trim() || undefined
  const filterClientId = query.client || undefined
  const filterProjectId = query.project || undefined
  const filterLeadId = query.lead || undefined
  const transcriptId = query.transcript || null

  // 'inbox' shows all transcripts (no classification filter)
  const classificationFilter = currentView === 'inbox'
    ? undefined
    : currentView.toUpperCase()

  const queryOptions = {
    classification: classificationFilter,
    search,
    clientId: filterClientId,
    projectId: filterProjectId,
    leadId: filterLeadId,
  }

  const [
    transcriptsList,
    totalCount,
    counts,
    clientsList,
    projectsList,
    leadsList,
    linkedTranscript,
  ] = await Promise.all([
    listTranscripts({ ...queryOptions, limit: PAGE_SIZE, offset }),
    getTranscriptTotalCount(queryOptions),
    getTranscriptCounts(),
    db
      .select({ id: clients.id, name: clients.name, slug: clients.slug })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(clients.name),
    db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        clientId: projects.clientId,
        type: projects.type,
        ownerId: projects.ownerId,
        createdBy: projects.createdBy,
      })
      .from(projects)
      .where(isNull(projects.deletedAt))
      .orderBy(projects.name),
    db
      .select({ id: leads.id, contactName: leads.contactName })
      .from(leads)
      .where(isNull(leads.deletedAt))
      .orderBy(leads.contactName),
    transcriptId ? getTranscriptById(transcriptId) : null,
  ])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <TranscriptPanel
      transcripts={transcriptsList}
      clients={clientsList}
      projects={projectsList}
      leads={leadsList}
      currentUserId={user.id}
      view={currentView}
      searchQuery={search ?? ''}
      sidebarCounts={{
        total: counts.unclassified + counts.classified + counts.dismissed,
        unclassified: counts.unclassified,
        classified: counts.classified,
        dismissed: counts.dismissed,
      }}
      pagination={{
        currentPage,
        totalPages,
        totalItems: totalCount,
        pageSize: PAGE_SIZE,
      }}
      initialSelectedTranscript={linkedTranscript}
      filterClientId={filterClientId}
      filterProjectId={filterProjectId}
      filterLeadId={filterLeadId}
    />
  )
}
