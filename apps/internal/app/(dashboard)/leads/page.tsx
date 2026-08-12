import type { Metadata } from 'next'

import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth/session'
import {
  fetchArchivedLeads,
  fetchLeadAssignees,
  fetchLeadsBoard,
} from '@/lib/data/leads'
import { NEW_SHEET_VALUE, UUID_PATTERN } from '@/lib/sheets/entities'
import { leadHref } from '@/lib/sheets/hrefs'

import { LeadsWorkspace } from './_components/leads-workspace'

export const metadata: Metadata = {
  title: 'Leads | Place to Stand Portal',
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export default async function LeadsBoardPage({ searchParams }: PageProps) {
  const user = await requireUser()
  const params = searchParams ? await searchParams : {}
  const leadParam = firstParam(params.lead) ?? null

  const [board, assignees] = await Promise.all([
    fetchLeadsBoard(user),
    fetchLeadAssignees(),
  ])

  // Deep-link resolution: the board holds every active lead, so a uuid param
  // that isn't on it is either archived (cross-redirect so shared links keep
  // working, submissions precedent) or gone (not-found notice).
  let leadNotFound = false
  if (leadParam && leadParam !== NEW_SHEET_VALUE) {
    if (!UUID_PATTERN.test(leadParam)) {
      leadNotFound = true
    } else {
      const onBoard = board.some(column =>
        column.leads.some(lead => lead.id === leadParam)
      )
      if (!onBoard) {
        const archived = await fetchArchivedLeads(user)
        if (archived.some(lead => lead.id === leadParam)) {
          redirect(leadHref(leadParam, { archived: true }))
        }
        leadNotFound = true
      }
    }
  }

  return (
    <LeadsWorkspace
      initialColumns={board}
      assignees={assignees}
      canManage
      senderName={user.full_name ?? user.email ?? ''}
      leadNotFound={leadNotFound}
    />
  )
}
