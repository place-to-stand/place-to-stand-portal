import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { fetchAgentSessionsOverview, fetchAgentSessionDetail } from '@/lib/data/agent-sessions'
import { fetchAdminUsers } from '@/lib/data/users'

import { AgentsWorkspace } from './_components/agents-workspace'
import { ALL_SESSIONS_OWNER } from './owner-scope'

export const metadata: Metadata = {
  title: 'Agents',
}

type AgentsPageProps = {
  searchParams: Promise<{ session?: string; owner?: string }>
}

export default async function AgentsPage({ searchParams }: AgentsPageProps) {
  const user = await requireRole('ADMIN')
  const { session: sessionId, owner: ownerParam } = await searchParams

  const admins = await fetchAdminUsers()

  // Each admin lands on their own session history by default — `owner=all`
  // is the everyone view, same shape as My Tasks' `assignee` param. A stale
  // or hand-edited admin id falls back to the signed-in user's own board.
  const requestedOwnerId = ownerParam ?? user.id
  const selectedOwnerId =
    requestedOwnerId === ALL_SESSIONS_OWNER
      ? ALL_SESSIONS_OWNER
      : requestedOwnerId !== user.id && admins.some(admin => admin.id === requestedOwnerId)
        ? requestedOwnerId
        : user.id

  const sessions = await fetchAgentSessionsOverview(selectedOwnerId === ALL_SESSIONS_OWNER ? undefined : selectedOwnerId)

  // Seeds the right pane's first paint when the URL already points at a
  // session (a shared link, or a refresh) — a failed lookup just means the
  // client hook fetches fresh instead of showing stale/missing data.
  const initialSessionDetail = sessionId
    ? await fetchAgentSessionDetail(user, sessionId).catch(() => null)
    : null

  return (
    <PageShell breadcrumbs={crumbsForNav('/agents')} contentClassName='flex min-h-0 flex-1 flex-col'>
      <AgentsWorkspace
        initialSessions={sessions}
        initialSelectedSessionId={sessionId ?? null}
        initialSessionDetail={initialSessionDetail}
        admins={admins}
        selectedOwnerId={selectedOwnerId}
        currentUser={{ id: user.id, name: user.full_name || user.email, avatarUrl: user.avatar_url }}
      />
    </PageShell>
  )
}
