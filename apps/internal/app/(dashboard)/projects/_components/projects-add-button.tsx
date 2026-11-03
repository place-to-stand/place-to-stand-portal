'use client'

import { SheetCreateButton } from '@/components/sheets/sheet-create-button'

type ProjectsAddButtonProps = {
  /** Whether any company is or was a client. */
  hasClients: boolean
  /**
   * Members can only create personal projects, which need no client, so the
   * button stays enabled for them even when no client exists.
   */
  allowWithoutClients?: boolean
  className?: string
}

/** "Create project" needs a client to attach to, so it waits for the first one. */
export function ProjectsAddButton({
  hasClients,
  allowWithoutClients = false,
  className,
}: ProjectsAddButtonProps) {
  return (
    <SheetCreateButton
      entity='project'
      label='Create project'
      className={className}
      disabledReason={
        !allowWithoutClients && !hasClients
          ? 'Add a client before creating a project.'
          : null
      }
    />
  )
}
