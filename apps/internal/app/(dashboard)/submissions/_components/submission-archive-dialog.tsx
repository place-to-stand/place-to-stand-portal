import { ConfirmDialog } from '@pts/ui/confirm-dialog'

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
    <ConfirmDialog
      open={open}
      title='Archive this submission?'
      description='It will move to the Archive tab and stop counting toward unread. You can restore it at any time.'
      confirmLabel='Archive'
      confirmVariant='destructive'
      confirmDisabled={confirmDisabled}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
