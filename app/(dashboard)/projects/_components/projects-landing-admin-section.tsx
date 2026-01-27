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

import { ProjectsLanding } from './projects-landing'
import { ProjectsTabsNav } from './projects-tabs-nav'

export type ProjectsLandingAdminSectionProps = {
  projects: ProjectWithRelations[]
  landingClients: Array<{ id: string; name: string; slug: string | null }>
  clients: ClientRow[]
  adminUsers: AdminUserForOwner[]
  currentUserId: string
  totalProjectCount: number
}

export function ProjectsLandingAdminSection({
  projects,
  landingClients,
  clients,
  adminUsers,
  currentUserId,
  totalProjectCount,
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

  const totalProjectsLabel = useMemo(() => {
    return String(totalProjectCount)
  }, [totalProjectCount])

  return (
    <div className='space-y-4'>
      {/* Tabs Row - Above the main container */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <ProjectsTabsNav
          activeTab='projects'
          className='flex-1 sm:flex-none'
        />
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6'>
          <span className='text-muted-foreground text-sm whitespace-nowrap'>
            Total projects: {totalProjectsLabel}
          </span>
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
        </div>
      </div>
      {/* Main Container with Background */}
      <section className='bg-background rounded-xl border p-6 shadow-sm'>
        <ProjectsLanding
          projects={projects}
          clients={landingClients}
          currentUserId={currentUserId}
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
    </div>
  )
}
