import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'

export type ProjectSheetDialogsProps = {
  isDeleteDialogOpen: boolean
  /** The project's name, for the archive confirmation. */
  projectName?: string | null
  isPending: boolean
  unsavedChangesDialog: React.ReactNode
  onCancelDelete: () => void
  onConfirmDelete: () => void
}

export function ProjectSheetDialogs(props: ProjectSheetDialogsProps) {
  const {
    isDeleteDialogOpen,
    projectName,
    isPending,
    unsavedChangesDialog,
    onCancelDelete,
    onConfirmDelete,
  } = props

  return (
    <>
      <ArchiveConfirmDialog
        open={isDeleteDialogOpen}
        entity='project'
        name={projectName || 'this project'}
        list='active projects'
        pending={isPending}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}
