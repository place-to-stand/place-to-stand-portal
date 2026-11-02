import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'

import type { ProjectWithClient } from './types'

type ProjectLifecycleDialogsProps = {
  deleteTarget: ProjectWithClient | null
  isPending: boolean
  onCancelDelete: () => void
  onConfirmDelete: () => void
}

export function ProjectLifecycleDialogs({
  deleteTarget,
  isPending,
  onCancelDelete,
  onConfirmDelete,
}: ProjectLifecycleDialogsProps) {
  return (
    <ArchiveConfirmDialog
      open={Boolean(deleteTarget)}
      entity='project'
      name={deleteTarget?.name ?? 'this project'}
      list='active projects'
      pending={isPending}
      onCancel={onCancelDelete}
      onConfirm={onConfirmDelete}
    />
  )
}
