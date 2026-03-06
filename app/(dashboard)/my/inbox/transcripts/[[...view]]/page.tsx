import { isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, projects, leads } from '@/lib/db/schema'
import { listTranscripts, getTranscriptCounts } from '@/lib/queries/transcripts'
import { TranscriptListView } from '../../_components/transcript-list-view'

type Props = {
  params: Promise<{ view?: string[] }>
  searchParams: Promise<{ q?: string }>
}

export default async function TranscriptsPage({ params, searchParams }: Props) {
  const user = await requireUser()
  assertAdmin(user)

  const { view } = await params
  const query = await searchParams

  const validViews = ['unclassified', 'classified', 'dismissed'] as const
  type ViewType = typeof validViews[number]
  const currentView: ViewType = validViews.includes(view?.[0] as ViewType)
    ? (view![0] as ViewType)
    : 'unclassified'

  const search = query.q?.trim() || undefined

  const [transcriptsList, counts, clientsList, projectsList, leadsList] = await Promise.all([
    listTranscripts({
      classification: currentView.toUpperCase(),
      search,
      limit: 50,
      offset: 0,
    }),
    getTranscriptCounts(),
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(clients.name),
    db
      .select({ id: projects.id, name: projects.name, clientId: projects.clientId })
      .from(projects)
      .where(isNull(projects.deletedAt))
      .orderBy(projects.name),
    db
      .select({ id: leads.id, contactName: leads.contactName })
      .from(leads)
      .where(isNull(leads.deletedAt))
      .orderBy(leads.contactName),
  ])

  return (
    <TranscriptListView
      transcripts={transcriptsList}
      counts={counts}
      currentView={currentView}
      clients={clientsList}
      projects={projectsList}
      leads={leadsList}
      searchQuery={search ?? ''}
    />
  )
}
