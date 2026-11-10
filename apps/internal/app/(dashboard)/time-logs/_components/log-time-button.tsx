'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { TimeLogDialog } from '@/app/(dashboard)/projects/_components/project-time-log/project-time-log-dialog'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
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
  // The dialog opens as soon as a project is picked; its data loads inside.
  const [dialog, setDialog] = useState<{
    projectId: string
    params: ProjectTimeLogDialogParams | null
    error: string | null
  } | null>(null)
  // A later pick (or a close) makes an earlier response stale.
  const requestRef = useRef(0)

  const openForProject = async (projectId: string) => {
    if (!projectId) return
    const request = ++requestRef.current
    setDialog({ projectId, params: null, error: null })
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
      const params = payload.data.params
      if (request === requestRef.current) {
        setDialog({ projectId, params, error: null })
      }
    } catch (error) {
      console.error('Failed to open the Log time dialog', error)
      if (request === requestRef.current) {
        setDialog({
          projectId,
          params: null,
          error: 'That project could not be opened. Please try again.',
        })
      }
    }
  }

  const close = () => {
    requestRef.current += 1
    setDialog(null)
  }

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
            disabled={projects.length === 0}
            aria-label='Log time: choose a project'
          >
            <Plus className='h-4 w-4' aria-hidden />
            Log time
          </Button>
        }
      />
      {dialog ? (
        <TimeLogDialog
          key={dialog.projectId}
          params={dialog.params}
          loadError={dialog.error}
          open
          onOpenChange={next => {
            if (!next) close()
          }}
          mode='create'
          timeLogEntry={null}
          onMutationSuccess={() => {
            close()
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}
