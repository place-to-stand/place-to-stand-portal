'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { ProjectSheet } from '@/app/(dashboard)/settings/projects/project-sheet'
import { useProjectsSettingsController } from '@/components/settings/projects/table/use-projects-settings-controller'
import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { useToast } from '@/components/ui/use-toast'
import { sortClientsByName } from '@/lib/settings/projects/project-sheet-form'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'
import type { ProjectWithRelations } from '@/lib/types'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { ProjectsLanding } from './projects-landing'
import type { ClientHoursData } from './projects-landing'
import { PROJECTS_TABS } from '../_lib/tabs'

export type ProjectsLandingAdminSectionProps = {
  projects: ProjectWithRelations[]
  landingClients: Array<{ id: string; name: string; slug: string | null }>
  clients: ClientRow[]
  adminUsers: AdminUserForOwner[]
  currentUserId: string
  totalProjectCount: number
  clientHoursMap?: Record<string, ClientHoursData>
}

export function ProjectsLandingAdminSection({
  projects,
  landingClients,
  clients,
  adminUsers,
  currentUserId,
  totalProjectCount,
  clientHoursMap = {},
}: ProjectsLandingAdminSectionProps) {
  const router = useRouter()
  const { toast } = useToast()
  const sortedClients = useMemo(() => sortClientsByName(clients), [clients])

  const {
    sheetOpen,
    selectedProject,
    handleSheetOpenChange,
    handleSheetComplete,
    openCreate,
  } = useProjectsSettingsController({
    toast,
    onRefresh: () => router.refresh(),
  })

  const createDisabled = sortedClients.length === 0
  const createDisabledReason = createDisabled
    ? 'Add a client before creating a project.'
    : null

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/projects')}
      tabs={PROJECTS_TABS}
      activeTab='projects'
      count={{ label: 'projects', total: totalProjectCount }}
      primaryAction={
        <DisabledFieldTooltip
          disabled={createDisabled}
          reason={createDisabledReason}
        >
          <Button
            type='button'
            size='sm'
            onClick={openCreate}
            disabled={createDisabled}
            className='gap-2'
          >
            <Plus className='h-4 w-4' />
            Add project
          </Button>
        </DisabledFieldTooltip>
      }
    >
      <section className='bg-background rounded-xl border p-6 shadow-sm'>
        <ProjectsLanding
          projects={projects}
          clients={landingClients}
          currentUserId={currentUserId}
          clientHoursMap={clientHoursMap}
        />
      </section>
      <ProjectSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onComplete={handleSheetComplete}
        project={selectedProject}
        clients={sortedClients}
        adminUsers={adminUsers}
        contractorDirectory={[]}
        projectContractors={{}}
      />
    </PageShell>
  )
}
