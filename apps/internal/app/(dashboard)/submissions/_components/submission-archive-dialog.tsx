import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'

type SubmissionArchiveDialogProps = {
  open: boolean
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function SubmissionArchiveDialog({
  open,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: SubmissionArchiveDialogProps) {
  return (
    <ArchiveConfirmDialog
      open={open}
      entity='submission'
      name='this submission'
      list='Submissions'
      extra='It stops counting toward unread, and you can restore it from the Archive tab.'
      pending={confirmDisabled}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
