import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type InvoiceVoidDialogProps = {
  open: boolean
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function InvoiceVoidDialog({
  open,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: InvoiceVoidDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title='Void invoice?'
      description='Voiding this invoice marks it as cancelled. This action cannot be undone.'
      confirmLabel='Void'
      confirmVariant='destructive'
      confirmDisabled={confirmDisabled}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
