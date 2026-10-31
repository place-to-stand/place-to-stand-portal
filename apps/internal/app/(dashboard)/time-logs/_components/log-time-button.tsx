'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { ProjectTimeLogDialog } from '@/app/(dashboard)/projects/_components/project-time-log/project-time-log-dialog'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import { toast } from '@/components/ui/use-toast'
import type { ProjectTimeLogDialogParams } from '@/lib/projects/time-log/types'

type LogTimeButtonProps = {
  /** Every live project; picking one opens the Log time dialog for it. */
  projects: SearchableComboboxItem[]
}

/**
 * The Time logs page-header action. Logging time needs a project, so the
 * button opens a project search first, then the same Log time dialog the
 * board and task sheet use, loaded for the chosen project.
 */
export function LogTimeButton({ projects }: LogTimeButtonProps) {
  const router = useRouter()
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null)
  const [dialogParams, setDialogParams] =
    useState<ProjectTimeLogDialogParams | null>(null)

  const openForProject = async (projectId: string) => {
    if (!projectId) return
    setLoadingProjectId(projectId)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/time-log-context`,
        { cache: 'no-store' }
      )
      const payload = (await response.json()) as {
        ok: boolean
        data?: { params: ProjectTimeLogDialogParams }
        error?: string
      }
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error ?? 'Request failed')
      }
      setDialogParams(payload.data.params)
    } catch (error) {
      console.error('Failed to open the Log time dialog', error)
      toast({
        title: 'Unable to log time',
        description: 'That project could not be opened. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoadingProjectId(null)
    }
  }

  const isLoading = loadingProjectId !== null

  return (
    <>
      <SearchableCombobox
        className='w-auto'
        items={projects}
        value={null}
        onChange={value => void openForProject(value)}
        searchPlaceholder='Search projects…'
        emptyMessage='No projects found.'
        trigger={
          <Button
            size='sm'
            type='button'
            className='gap-2'
            disabled={isLoading || projects.length === 0}
            aria-label='Log time: choose a project'
          >
            {isLoading ? (
              <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
            ) : (
              <Plus className='h-4 w-4' aria-hidden />
            )}
            Log time
          </Button>
        }
      />
      {dialogParams ? (
        <ProjectTimeLogDialog
          {...dialogParams}
          open
          onOpenChange={next => {
            if (!next) setDialogParams(null)
          }}
          mode='create'
          timeLogEntry={null}
          onMutationSuccess={() => {
            setDialogParams(null)
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}
