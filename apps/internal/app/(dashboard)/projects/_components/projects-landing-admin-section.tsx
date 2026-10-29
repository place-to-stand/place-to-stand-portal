'use client'

import { useMemo } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'
import { sortClientsByName } from '@/lib/settings/projects/project-sheet-form'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'
import type { LandingProject } from '@/lib/data/projects'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import type { ProjectStatusValue } from '@/lib/constants'

import { ProjectsLanding } from './projects-landing'
import type { ClientHoursData, LandingUnfilteredCounts } from './projects-landing'
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
  const sortedClients = useMemo(() => sortClientsByName(clients), [clients])

  // This section only ever *creates* projects (row clicks go to the project
  // workspace), so it opens `?project=new` and lets the global SheetHost
  // render the sheet instead of owning a second instance.
  const { openCreate } = useSheetParamSelection('project')

  const createDisabled = sortedClients.length === 0
  const createDisabledReason = createDisabled
    ? 'Add a client before creating a project.'
    : null

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/projects')}
      tabs={memberView ? undefined : PROJECTS_TABS}
      activeTab={memberView ? undefined : 'projects'}
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
        <DisabledFieldTooltip
          disabled={!memberView && createDisabled}
          reason={memberView ? null : createDisabledReason}
        >
          <Button
            type='button'
            size='sm'
            onClick={openCreate}
            disabled={!memberView && createDisabled}
            className='gap-2'
          >
            <Plus className='h-4 w-4' />
            Add project
          </Button>
        </DisabledFieldTooltip>
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
