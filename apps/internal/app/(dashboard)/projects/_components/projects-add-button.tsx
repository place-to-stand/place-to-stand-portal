'use client'

import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'

type ProjectsAddButtonProps = {
  clients: ClientRow[]
  /**
   * Members can only create personal projects, which need no client, so the
   * button stays enabled for them even when no client exists.
   */
  allowWithoutClients?: boolean
  className?: string
}

/** "Create project" needs a client to attach to, so it waits for the first one. */
export function ProjectsAddButton({
  clients,
  allowWithoutClients = false,
  className,
}: ProjectsAddButtonProps) {
  return (
    <SheetCreateButton
      entity='project'
      label='Create project'
      className={className}
      disabledReason={
        !allowWithoutClients && clients.length === 0
          ? 'Add a client before creating a project.'
          : null
      }
    />
  )
}
