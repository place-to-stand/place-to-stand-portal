'use client'

import { Button } from '@pts/ui/button'

/**
 * Shown above a list when a `?<entity>=<id>` link points at a record that no
 * longer exists. One wording for every list.
 */
export function DeepLinkNotFoundNotice({
  entity,
  onDismiss,
}: {
  /** Singular noun: "client" → "The linked client could not be found." */
  entity: string
  onDismiss: () => void
}) {
  return (
    <div
      role='status'
      className='border-destructive/30 bg-destructive/5 flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm'
    >
      <span>
        The linked {entity} could not be found. It may have been permanently
        deleted.
      </span>
      <Button variant='ghost' size='sm' onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  )
}
