import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'

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
    <ArchiveConfirmDialog
      open={open}
      entity='invoice'
      name='this invoice'
      list='active invoices'
      pending={confirmDisabled}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
