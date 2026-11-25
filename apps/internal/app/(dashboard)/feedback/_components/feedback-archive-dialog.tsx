import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'

export function FeedbackArchiveDialog({
  open,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: {
  open: boolean
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <ArchiveConfirmDialog
      open={open}
      entity='report'
      name='this report'
      list='Feedback'
      extra='Its task, if it has one, stays. You can restore it from the Archive tab.'
      pending={confirmDisabled}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
