/**
 * Rows of Settings → Billing's tables live in the page form until Save. A
 * new row gets a local id (`new-…`) that Save swaps for a real one; a row
 * that differs from what was saved shows a quiet "New" or "Edited".
 */

const NEW_ROW_PREFIX = 'new-'

export function newRowId(): string {
  return `${NEW_ROW_PREFIX}${crypto.randomUUID()}`
}

function isNewRowId(id: string): boolean {
  return id.startsWith(NEW_ROW_PREFIX)
}

type RowChange = 'new' | 'edited' | null

export function rowChange<T extends { id: string }>(
  row: T,
  saved: T | undefined
): RowChange {
  if (!saved) return isNewRowId(row.id) ? 'new' : null
  return JSON.stringify(row) === JSON.stringify(saved) ? null : 'edited'
}

export function RowChangeBadge({ change }: { change: RowChange }) {
  if (!change) return null
  return (
    <span className='text-muted-foreground ml-2 text-xs font-normal'>
      {change === 'new' ? 'New' : 'Edited'}
    </span>
  )
}
