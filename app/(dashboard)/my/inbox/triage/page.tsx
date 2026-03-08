import { isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, projects, leads } from '@/lib/db/schema'
import { getInboxSidebarCounts } from '@/lib/queries/threads'
import { getTranscriptCounts } from '@/lib/queries/transcripts'

import { TriageView } from '../_components/triage-view'

export default async function TriagePage() {
  const user = await requireUser()
  assertAdmin(user)

  const [clientsList, projectsList, leadsList, sidebarCounts, transcriptCounts] = await Promise.all([
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
      .select({
        id: leads.id,
        contactName: leads.contactName,
        contactEmail: leads.contactEmail,
      })
      .from(leads)
      .where(isNull(leads.deletedAt))
      .orderBy(leads.contactName),
    getInboxSidebarCounts(user.id),
    getTranscriptCounts(),
  ])

  return (
    <TriageView
      clients={clientsList}
      projects={projectsList}
      leads={leadsList}
      currentUserId={user.id}
      serverQueueSize={sidebarCounts.unclassified + transcriptCounts.unclassified}
    />
  )
}
