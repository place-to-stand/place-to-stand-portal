import type { Metadata } from 'next'
import { Suspense } from 'react'

import { redirect } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireUser } from '@/lib/auth/session'
import {
  fetchArchivedLeads,
  fetchLeadAssignees,
  fetchLeadsBoard,
} from '@/lib/data/leads'
import { NEW_SHEET_VALUE, UUID_PATTERN } from '@/lib/sheets/entities'
import { leadHref } from '@/lib/sheets/hrefs'

import { LeadsWorkspace } from './_components/leads-workspace'
import { LEADS_TABS } from './_lib/tabs'

export const metadata: Metadata = {
  title: 'Leads | Place to Stand Portal',
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

// All auth + data access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function LeadsBoardContent({ searchParams }: PageProps) {
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

// Mirrors the PageShell chrome that LeadsWorkspace renders (breadcrumbs ·
// tabs · viewport-pinned content wrapper) so only the board area pulses while
// data streams in. The add button and count live inside the client workspace,
// so they appear with the content.
function LeadsBoardPageFallback() {
  return (
    <PageShell
      breadcrumbs={crumbsForNav('/leads')}
      tabs={LEADS_TABS}
      activeTab='board'
      // Kanban board: pin to the viewport (columns scroll internally).
      contentClassName='flex h-full min-h-0 flex-col gap-4 sm:gap-6'
    >
      <section className='bg-background min-h-0 flex-1 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function LeadsBoardPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<LeadsBoardPageFallback />}>
      <LeadsBoardContent searchParams={searchParams} />
    </Suspense>
  )
}
