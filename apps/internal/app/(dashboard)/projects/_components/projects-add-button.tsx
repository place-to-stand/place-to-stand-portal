'use client'

import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'

type ProjectsAddButtonProps = {
  clients: ClientRow[]
  className?: string
}

/** "Add project" needs a client to attach to, so it waits for the first one. */
export function ProjectsAddButton({
  clients,
  className,
}: ProjectsAddButtonProps) {
  return (
    <SheetCreateButton
      entity='project'
      label='Add project'
      className={className}
      disabledReason={
        clients.length === 0 ? 'Add a client before creating a project.' : null
      }
    />
  )
}
