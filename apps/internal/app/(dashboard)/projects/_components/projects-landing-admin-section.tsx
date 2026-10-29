'use client'

import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'
import type { LandingProject } from '@/lib/data/projects'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import type { ProjectStatusValue } from '@/lib/constants'

import { ProjectsAddButton } from './projects-add-button'
import { ProjectsLanding } from './projects-landing'
import type {
  ClientHoursData,
  LandingUnfilteredCounts,
} from './projects-landing'
import { ProjectsLandingFilters } from './projects-landing-filters'
import { PROJECTS_TABS } from '../_lib/tabs'

export type ProjectsLandingAdminSectionProps = {
  projects: LandingProject[]
  landingClients: Array<{ id: string; name: string; slug: string | null }>
  clients: ClientRow[]
  /** Owner picker options for the table's avatar cell. */
  admins: AdminUserForOwner[]
  currentUserId: string
  /** Unfiltered visible-project total (pre status/search filter). */
  totalProjectCount: number
  /** Visible-project total after the active status/search filter. */
  filteredProjectCount: number
  statuses: ProjectStatusValue[]
  search?: string
  filtersActive: boolean
  unfilteredCounts: LandingUnfilteredCounts
  clientHoursMap?: Record<string, ClientHoursData>
  /**
   * Project members (non-admins): read-only list and no tabs. "Add project"
   * opens the same sheet, which offers only what their role can create.
   */
  memberView?: boolean
}

export function ProjectsLandingAdminSection({
  projects,
  landingClients,
  clients,
  admins,
  currentUserId,
  totalProjectCount,
  filteredProjectCount,
  statuses,
  search,
  filtersActive,
  unfilteredCounts,
  clientHoursMap = {},
  memberView = false,
}: ProjectsLandingAdminSectionProps) {
  return (
    <PageShell
      breadcrumbs={crumbsForNav('/projects')}
      // Members get the same tab bar with just the main tab, so the page
      // reads like everyone else's (Archive and Activity are admin-only).
      tabs={memberView ? PROJECTS_TABS.slice(0, 1) : PROJECTS_TABS}
      activeTab='projects'
      count={
        // R2/03.E5: the implicit default status view must not read as
        // filtered — show a plain visible-count until a filter is active.
        filtersActive
          ? {
              label: 'projects',
              total: totalProjectCount,
              filteredTotal: filteredProjectCount,
            }
          : { label: 'projects', total: filteredProjectCount }
      }
      primaryAction={
        // Everyone gets the same sheet; it offers only what the role can use.
        <ProjectsAddButton clients={clients} allowWithoutClients={memberView} />
      }
    >
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <ProjectsLandingFilters statuses={statuses} search={search} />
        <ProjectsLanding
          projects={projects}
          clients={landingClients}
          admins={admins}
          currentUserId={currentUserId}
          clientHoursMap={clientHoursMap}
          unfilteredCounts={unfilteredCounts}
          filtersActive={filtersActive}
          readOnly={memberView}
        />
      </section>
    </PageShell>
  )
}
