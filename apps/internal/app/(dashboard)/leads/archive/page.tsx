import type { Metadata } from 'next'

import { redirect } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireCrmUser } from '@/lib/auth/session'
import { assertCrmAccess } from '@/lib/auth/permissions'
import {
  fetchArchivedLeads,
  fetchLeadAssignees,
  fetchLeadsBoard,
} from '@/lib/data/leads'
import { NEW_SHEET_VALUE, UUID_PATTERN } from '@/lib/sheets/entities'
import { leadHref } from '@/lib/sheets/hrefs'

import { filterArchivedLeads } from '../_lib/archive-filters'
import { LEADS_TABS } from '../_lib/tabs'
import { LeadsArchiveSection } from '../_components/leads-archive-section'

export const metadata: Metadata = {
  title: 'Lead archive',
}

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export default async function LeadsArchivePage({
  searchParams,
}: PageProps<'/leads/archive'>) {
  const user = await requireCrmUser()
  assertCrmAccess(user)
  const params = await searchParams
  const leadParam = firstParam(params.lead) ?? null

  const [archivedLeads, assignees] = await Promise.all([
    fetchArchivedLeads(user),
    fetchLeadAssignees(),
  ])

  // Deep-link resolution: a uuid param that isn't archived is either still
  // active (cross-redirect to the board) or gone (not-found notice).
  let leadNotFound = false
  if (leadParam && leadParam !== NEW_SHEET_VALUE) {
    if (!UUID_PATTERN.test(leadParam)) {
      leadNotFound = true
    } else if (!archivedLeads.some(lead => lead.id === leadParam)) {
      const board = await fetchLeadsBoard(user)
      if (
        board.some(column => column.leads.some(lead => lead.id === leadParam))
      ) {
        redirect(leadHref(leadParam))
      }
      leadNotFound = true
    }
  }

  // The table filters in memory; mirror it here for "Showing X of Y".
  const filteredTotal = filterArchivedLeads(archivedLeads, {
    status: firstParam(params.status),
    q: firstParam(params.q),
  }).length

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/leads'), { label: 'Archive' }]}
      tabs={LEADS_TABS}
      activeTab='archive'
      count={{
        label: 'archived leads',
        total: archivedLeads.length,
        filteredTotal,
      }}
      primaryAction={<SheetCreateButton entity='lead' label='Create lead' />}
    >
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <LeadsArchiveSection
          leads={archivedLeads}
          assignees={assignees}
          senderName={user.full_name ?? user.email ?? ''}
          leadNotFound={leadNotFound}
        />
      </section>
    </PageShell>
  )
}
