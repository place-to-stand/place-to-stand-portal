import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'

type HourBlockArchiveDialogProps = {
  open: boolean
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function HourBlockArchiveDialog({
  open,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: HourBlockArchiveDialogProps) {
  return (
    <ArchiveConfirmDialog
      open={open}
      entity='hour block'
      name='this hour block'
      list='active hour blocks'
      pending={confirmDisabled}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
