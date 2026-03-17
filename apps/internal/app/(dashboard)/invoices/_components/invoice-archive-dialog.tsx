import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type InvoiceArchiveDialogProps = {
  open: boolean
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function InvoiceArchiveDialog({
  open,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: InvoiceArchiveDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title='Archive invoice?'
      description='Archiving this invoice hides it from active views while retaining historical records.'
      confirmLabel='Archive'
      confirmVariant='destructive'
      confirmDisabled={confirmDisabled}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
