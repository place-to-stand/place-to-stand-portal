import type { Metadata } from 'next'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { fetchArchivedLeads, fetchLeadAssignees, fetchLeadsBoard } from '@/lib/data/leads'
import { NEW_SHEET_VALUE, UUID_PATTERN } from '@/lib/sheets/entities'
import { leadHref, newLeadHref } from '@/lib/sheets/hrefs'

import { LEADS_TABS } from '../_lib/tabs'
import { LeadsArchiveSection } from '../_components/leads-archive-section'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = {
  title: 'Lead Archive | Place to Stand Portal',
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export default async function LeadsArchivePage({ searchParams }: PageProps) {
  const user = await requireUser()
  assertAdmin(user)
  const params = searchParams ? await searchParams : {}
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

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/leads'), { label: 'Archive' }]}
      tabs={LEADS_TABS}
      activeTab='archive'
      count={{ label: 'archived leads', total: archivedLeads.length }}
      primaryAction={
        <Button asChild size='sm' className='gap-2'>
          <Link href={newLeadHref()}>
            <Plus className='h-4 w-4' />
            Add lead
          </Link>
        </Button>
      }
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm space-y-3'>
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
