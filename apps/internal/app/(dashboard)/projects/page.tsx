import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import type { ClientHoursData } from './_components/projects-landing'
import { ProjectsLandingAdminSection } from './_components/projects-landing-admin-section'
import { ProjectsAddButton } from './_components/projects-add-button'
import { parseProjectsLandingSearchParams } from './_lib/parse-projects-search-params'
import { PROJECTS_TABS } from './_lib/tabs'
import {
  fetchLandingProjectCounts,
  fetchProjectsForLanding,
} from '@/lib/data/projects'
import {
  fetchClientHoursSummaries,
  type ClientHoursSummary,
} from '@/lib/data/clients'
import { fetchAdminUsers } from '@/lib/data/users'
import { requireUser } from '@/lib/auth/session'
import { fetchClientDirectory } from '@/lib/queries/clients'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'
import type { ProjectWithRelations } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Projects | Place to Stand Portal',
}

type ProjectsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

// All auth + data access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function ProjectsContent({ searchParams }: ProjectsPageProps) {
  const user = await requireUser()
  const params = searchParams ? await searchParams : {}
  const { statuses, search, filtersActive } =
    parseProjectsLandingSearchParams(params)

  // One wave: nothing below depends on anything else here, and the old
  // second Promise.all added a full serial round-trip level per request.
  const [projects, unfilteredCounts, clientHoursSummaries, clientDirectory, admins] =
    await Promise.all([
      fetchProjectsForLanding({
        statuses,
        search: search ?? undefined,
      }),
      fetchLandingProjectCounts(user.id),
      fetchClientHoursSummaries(user),
      fetchClientDirectory(),
      fetchAdminUsers(),
    ])
  const landingClients = buildLandingClients(projects)
  const filteredProjectCount = countVisibleProjects(projects, user.id)
  const clientHoursMap = buildClientHoursMap(clientHoursSummaries)

  const clientRows: ClientRow[] = clientDirectory.map(client => ({
    id: client.id,
    name: client.name,
    deleted_at: client.deletedAt,
  }))

  const adminUsers: AdminUserForOwner[] = admins.map(admin => ({
    id: admin.id,
    full_name: admin.full_name,
    email: admin.email,
    avatar_url: admin.avatar_url,
  }))


  return (
    <ProjectsLandingAdminSection
        projects={projects}
        landingClients={landingClients}
        clients={clientRows}
        admins={adminUsers}
        currentUserId={user.id}
        totalProjectCount={unfilteredCounts.total}
        filteredProjectCount={filteredProjectCount}
        statuses={statuses}
        search={search ?? undefined}
        filtersActive={filtersActive}
        unfilteredCounts={unfilteredCounts}
        clientHoursMap={clientHoursMap}
      />
  )
}

// Identical header chrome (breadcrumbs · tabs · add button) so only the
// table area pulses while data streams in — the count chip appears with it.
function ProjectsPageFallback() {
  return (
    <PageShell
      breadcrumbs={crumbsForNav('/projects')}
      tabs={PROJECTS_TABS}
      activeTab='projects'
      primaryAction={<ProjectsAddButton clients={[]} />}
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function ProjectsPage({ searchParams }: ProjectsPageProps) {
  return (
    <Suspense fallback={<ProjectsPageFallback />}>
      <ProjectsContent searchParams={searchParams} />
    </Suspense>
  )
}

type LandingClient = { id: string; name: string; slug: string | null }

function buildLandingClients(
  projects: ProjectWithRelations[]
): LandingClient[] {
  const map = new Map<string, LandingClient>()

  projects.forEach(project => {
    if (project.client) {
      map.set(project.client.id, {
        id: project.client.id,
        name: project.client.name,
        slug: project.client.slug,
      })
    }
  })

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function countVisibleProjects(
  projects: ProjectWithRelations[],
  currentUserId: string
): number {
  return projects.filter(project => {
    if (project.type !== 'PERSONAL') {
      return true
    }

    return project.created_by === currentUserId
  }).length
}

function buildClientHoursMap(
  clients: ClientHoursSummary[]
): Record<string, ClientHoursData> {
  const map: Record<string, ClientHoursData> = {}

  clients.forEach(client => {
    if (client.billingType === 'prepaid') {
      map[client.id] = {
        billingType: client.billingType,
        hoursRemaining: client.hoursRemaining,
        totalHoursPurchased: client.totalHoursPurchased,
      }
    } else if (client.billingType === 'net_30') {
      map[client.id] = {
        billingType: 'net_30',
      }
    }
  })

  return map
}
