'use client'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'

type ArchiveConfirmDialogProps = {
  open: boolean
  /** The record type, lower case: "project", "lead", "task". */
  entity: string
  /** The record's name, or "this <entity>" when there isn't one. */
  name: string
  /** Where it stops showing: "active projects", "the board". */
  list: string
  /** One more sentence, for consequences beyond hiding it. */
  extra?: string
  /** Disables the confirm button and says "Archiving…". */
  pending?: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * The one archive confirmation: "Archive <entity>?", then "Archiving <name>
 * hides it from <list>. Its history stays." Archiving is a soft delete, so
 * nothing is lost and it can be restored.
 */
export function ArchiveConfirmDialog({
  open,
  entity,
  name,
  list,
  extra,
  pending = false,
  onCancel,
  onConfirm,
}: ArchiveConfirmDialogProps) {
  const description = `Archiving ${name} hides it from ${list}. Its history stays.${
    extra ? ` ${extra}` : ''
  }`

  return (
    <ConfirmDialog
      open={open}
      title={`Archive ${entity}?`}
      description={description}
      confirmLabel={pending ? 'Archiving…' : `Archive ${entity}`}
      confirmVariant='destructive'
      confirmDisabled={pending}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
