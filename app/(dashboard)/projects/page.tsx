import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { ProjectsLanding } from './_components/projects-landing'
import type { ClientHoursData } from './_components/projects-landing'
import { ProjectsLandingAdminSection } from './_components/projects-landing-admin-section'
import { ProjectsLandingHeader } from './_components/projects-landing-header'
import { fetchProjectsWithRelations } from '@/lib/data/projects'
import { fetchClientsWithMetrics } from '@/lib/data/clients'
import { fetchAdminUsers } from '@/lib/data/users'
import { isAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import {
  listProjectsForSettings,
  type ProjectsSettingsResult,
} from '@/lib/queries/projects'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'
import type { ProjectWithRelations } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Projects | Place to Stand Portal',
}

export default async function ProjectsPage() {
  const user = await requireUser()
  const [projects, clientsWithMetrics] = await Promise.all([
    fetchProjectsWithRelations({
      forUserId: user.id,
      forRole: user.role,
    }),
    fetchClientsWithMetrics(user),
  ])
  const landingClients = buildLandingClients(projects)
  const visibleProjectCount = countVisibleProjects(projects, user.id)
  const clientHoursMap = buildClientHoursMap(clientsWithMetrics)

  if (!isAdmin(user)) {
    return renderProjectLanding({ user, projects, landingClients, clientHoursMap, userIsAdmin: false })
  }

  const [managementResult, adminUsersResult]: [ProjectsSettingsResult, Awaited<ReturnType<typeof fetchAdminUsers>>] =
    await Promise.all([
      listProjectsForSettings(user, {
        status: 'active',
        limit: 1,
      }),
      fetchAdminUsers(),
    ])

  const clientRows: ClientRow[] = managementResult.clients.map(client => ({
    id: client.id,
    name: client.name,
    deleted_at: client.deletedAt,
  }))

  const adminUsers: AdminUserForOwner[] = adminUsersResult.map(admin => ({
    id: admin.id,
    full_name: admin.full_name,
    email: admin.email,
    avatar_url: admin.avatar_url,
  }))

  return (
    <>
      <AppShellHeader>
        <ProjectsLandingHeader
          projects={projects}
          clients={landingClients}
          currentUserId={user.id}
        />
      </AppShellHeader>
      <ProjectsLandingAdminSection
        projects={projects}
        landingClients={landingClients}
        clients={clientRows}
        adminUsers={adminUsers}
        currentUserId={user.id}
        totalProjectCount={visibleProjectCount}
        clientHoursMap={clientHoursMap}
      />
    </>
  )
}

type LandingClient = { id: string; name: string; slug: string | null }

function renderProjectLanding({
  user,
  projects,
  landingClients,
  clientHoursMap,
  userIsAdmin,
}: {
  user: Awaited<ReturnType<typeof requireUser>>
  projects: ProjectWithRelations[]
  landingClients: LandingClient[]
  clientHoursMap: Record<string, ClientHoursData>
  userIsAdmin: boolean
}) {
  const sortableProjects = [...projects]

  return (
    <>
      <AppShellHeader>
        <ProjectsLandingHeader
          projects={sortableProjects}
          clients={landingClients}
          currentUserId={user.id}
        />
      </AppShellHeader>
      <div className='space-y-6'>
        <ProjectsLanding
          projects={sortableProjects}
          clients={landingClients}
          currentUserId={user.id}
          isAdmin={userIsAdmin}
          clientHoursMap={clientHoursMap}
        />
      </div>
    </>
  )
}

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
