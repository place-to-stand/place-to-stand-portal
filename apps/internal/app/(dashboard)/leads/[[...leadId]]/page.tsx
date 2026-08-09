import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth/session'
import { fetchLeadAssignees, fetchLeadsBoard } from '@/lib/data/leads'

import { LeadsWorkspace } from '../_components/leads-workspace'

export const metadata: Metadata = {
  title: 'Leads | Place to Stand Portal',
}

type PageParams = {
  leadId?: string[]
}

type PageProps = {
  params: Promise<PageParams>
}

export default async function LeadsBoardPage({ params }: PageProps) {
  const resolvedParams = await params
  const requestedLeadId = resolvedParams.leadId?.[0] ?? null
  const actionSegment = resolvedParams.leadId?.[1] ?? null
  const user = await requireUser()

  // /leads/new: create deep link (archive's Add lead button lands here).
  const startCreating = requestedLeadId === 'new'
  const activeLeadId = startCreating ? null : requestedLeadId

  // Derive activeAction from URL segments
  let activeAction: string | null = null
  if (activeLeadId && actionSegment === 'convert') {
    activeAction = 'convert'
  }

  const [board, assignees] = await Promise.all([
    fetchLeadsBoard(user),
    fetchLeadAssignees(),
  ])

  return (
    <LeadsWorkspace
      initialColumns={board}
      assignees={assignees}
      canManage
      activeLeadId={activeLeadId}
      activeAction={activeAction}
      startCreating={startCreating}
      senderName={user.full_name ?? user.email ?? ''}
    />
  )
}

