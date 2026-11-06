import type { Metadata } from 'next'

import { redirect } from 'next/navigation'

import { requirePage } from '@/lib/auth/session'
import {
  fetchLeadAssignees,
  fetchLeadsBoard,
  isArchivedLead,
} from '@/lib/data/leads'
import {
  NEW_SHEET_VALUE,
  UUID_PATTERN,
  parseDuplicateSourceId,
} from '@/lib/sheets/entities'
import { leadHref } from '@/lib/sheets/hrefs'

import { LeadsWorkspace } from './_components/leads-workspace'
import { firstParam } from '@/lib/pagination/params'

export const metadata: Metadata = {
  title: 'Leads',
}

export default async function LeadsBoardPage({
  searchParams,
}: PageProps<'/leads'>) {
  // permission: leads.manage
  const user = await requirePage('leads.manage')
  const params = await searchParams
  const leadParam = firstParam(params.lead) ?? null
  // `?assignee=`: a user id, `me` (the My aging leads "See all"), or `all`
  // for everyone's leads. Absent shows the viewer's own leads, as My tasks
  // does.
  const assigneeParam = firstParam(params.assignee)
  const assigneeFilter =
    assigneeParam === 'all'
      ? 'all'
      : assigneeParam && UUID_PATTERN.test(assigneeParam)
        ? assigneeParam
        : user.id

  // The whole board goes to the client even with `?assignee=me`: it filters
  // what shows, while deep links and drag ranks still see every lead.
  const [fullBoard, assignees] = await Promise.all([
    fetchLeadsBoard(user),
    fetchLeadAssignees(),
  ])

  // Deep-link resolution: the board holds every active lead, so a uuid param
  // that isn't on it is either archived (cross-redirect so shared links keep
  // working, submissions precedent) or gone (not-found notice).
  let leadNotFound = false
  if (
    leadParam &&
    leadParam !== NEW_SHEET_VALUE &&
    !parseDuplicateSourceId(leadParam)
  ) {
    if (!UUID_PATTERN.test(leadParam)) {
      leadNotFound = true
    } else {
      const onBoard = fullBoard.some(column =>
        column.leads.some(lead => lead.id === leadParam)
      )
      if (!onBoard) {
        if (await isArchivedLead(user, leadParam)) {
          redirect(leadHref(leadParam, { archived: true }))
        }
        leadNotFound = true
      }
    }
  }

  return (
    <LeadsWorkspace
      initialColumns={fullBoard}
      assignees={assignees}
      canManage
      senderName={user.full_name ?? user.email ?? ''}
      leadNotFound={leadNotFound}
      assigneeFilter={assigneeFilter}
      viewerId={user.id}
    />
  )
}
