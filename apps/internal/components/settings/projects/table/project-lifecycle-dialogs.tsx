import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'

import type { ProjectWithClient } from './types'

type ProjectLifecycleDialogsProps = {
  deleteTarget: ProjectWithClient | null
  destroyTarget: ProjectWithClient | null
  isPending: boolean
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onCancelDestroy: () => void
  onConfirmDestroy: () => void
}

export function ProjectLifecycleDialogs({
  deleteTarget,
  destroyTarget,
  isPending,
  onCancelDelete,
  onConfirmDelete,
  onCancelDestroy,
  onConfirmDestroy,
}: ProjectLifecycleDialogsProps) {
  return (
    <>
      <ArchiveConfirmDialog
        open={Boolean(deleteTarget)}
        entity='project'
        name={deleteTarget?.name ?? 'this project'}
        list='active projects'
        pending={isPending}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Permanently delete project?'
        description={
          destroyTarget
            ? `Permanently deleting ${destroyTarget.name} removes this project and its memberships. This action cannot be undone.`
            : 'Permanently deleting this project removes it and its memberships. This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={onCancelDestroy}
        onConfirm={onConfirmDestroy}
      />
    </>
  )
}
