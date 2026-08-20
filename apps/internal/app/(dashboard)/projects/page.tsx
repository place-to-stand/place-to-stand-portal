import type { Metadata } from 'next'

import type { ClientHoursData } from './_components/projects-landing'
import { ProjectsLandingAdminSection } from './_components/projects-landing-admin-section'
import { parseProjectsLandingSearchParams } from './_lib/parse-projects-search-params'
import {
  fetchLandingProjectCounts,
  fetchProjectsForLanding,
} from '@/lib/data/projects'
import { fetchClientsWithMetrics } from '@/lib/data/clients'
import { fetchAdminUsers } from '@/lib/data/users'
import { requireUser } from '@/lib/auth/session'
import { fetchClientDirectory } from '@/lib/queries/clients'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'
import type { ProjectWithRelations } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Projects | Place to Stand Portal',
}

type ProjectsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const user = await requireUser()
  const params = searchParams ? await searchParams : {}
  const { statuses, search, filtersActive } =
    parseProjectsLandingSearchParams(params)

  // One wave: nothing below depends on anything else here, and the old
  // second Promise.all added a full serial round-trip level per request.
  const [projects, unfilteredCounts, clientsWithMetrics, clientDirectory, adminUsers] =
    await Promise.all([
      fetchProjectsForLanding({
        statuses,
        search: search ?? undefined,
      }),
      fetchLandingProjectCounts(user.id),
      fetchClientsWithMetrics(user),
      fetchClientDirectory(),
      fetchAdminUsers(),
    ])
  const landingClients = buildLandingClients(projects)
  const filteredProjectCount = countVisibleProjects(projects, user.id)
  const clientHoursMap = buildClientHoursMap(clientsWithMetrics)

  const ownerOptions = adminUsers.map(admin => ({
    id: admin.id,
    name: admin.full_name ?? admin.email,
    avatarUrl: admin.avatar_url,
  }))

  const clientRows: ClientRow[] = clientDirectory.map(client => ({
    id: client.id,
    name: client.name,
    deleted_at: client.deletedAt,
  }))


  return (
    <ProjectsLandingAdminSection
        projects={projects}
        landingClients={landingClients}
        clients={clientRows}
        currentUserId={user.id}
        totalProjectCount={unfilteredCounts.total}
        filteredProjectCount={filteredProjectCount}
        statuses={statuses}
        search={search ?? undefined}
        filtersActive={filtersActive}
        unfilteredCounts={unfilteredCounts}
        clientHoursMap={clientHoursMap}
        ownerOptions={ownerOptions}
      />
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
  clients: Awaited<ReturnType<typeof fetchClientsWithMetrics>>
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
