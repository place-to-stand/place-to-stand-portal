'use client'

import { X } from 'lucide-react'

import { Input } from '@pts/ui/input'
import { RowActionButton } from '@pts/ui/row-action-button'
import {
  RECORD_ROW_INPUT_CLASS,
  RecordRowField,
  SheetRecordRow,
} from '@/components/sheets/sheet-record-row'
import { EntityList } from '@/components/sheets/entity-list'
import { usePendingRemovals } from '@/components/sheets/use-pending-removals'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { cn } from '@/lib/utils'

import { closerKey } from '@/lib/companies/billing/closers'
import type {
  CloserCandidate,
  CloserDraft,
} from '@/lib/companies/billing/use-client-sheet-state'
import { ENTITY_ICONS } from '@/lib/entity-accents'

import { StaffOrPersonPicker } from './staff-or-person-picker'

export type ClientClosersEditorProps = {
  closers: CloserDraft[]
  availableUsers: CloserCandidate[]
  availableContacts: CloserCandidate[]
  /** Sum of the typed shares, or null when a share isn't a number yet. */
  shareTotal: number | null
  hasError: boolean
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  pendingReason: string
  onPickerOpenChange: (open: boolean) => void
  onAdd: (candidate: CloserCandidate) => void
  onRemove: (key: string) => void
  onShareChange: (key: string, shareText: string) => void
  /** Open the contact create sheet; the new contact is added as a closer. */
  onCreateContact: (query: string) => void
}

/**
 * The closers on a client's commission split. One closer takes the whole
 * closer rate, so the share field only appears once there are two or more;
 * adding or removing a closer re-splits evenly, then shares are hand-tuned.
 */
export function ClientClosersEditor({
  closers,
  availableUsers,
  availableContacts,
  shareTotal,
  hasError,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  pendingReason,
  onPickerOpenChange,
  onAdd,
  onRemove,
  onShareChange,
  onCreateContact,
}: ClientClosersEditorProps) {
  const isSplit = closers.length > 1
  const locked = isPending || disabled
  const lockedReason = isPending ? pendingReason : disabledReason
  // Removed closers stay as Pending removal, with Undo, until Save.
  const removals = usePendingRemovals<CloserDraft>(closerKey, closers)
  const pendingRemovals = removals.pending

  return (
    <EntityList
      title={closers.length > 1 ? 'Closers' : 'Closer'}
      titleAddon={
        isSplit ? (
          <span
            className={cn(
              'text-sm font-normal tabular-nums',
              hasError ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            Total {shareTotal === null ? '—' : `${shareTotal}%`}
          </span>
        ) : null
      }
      add={{
        label: 'Add closer',
        onAdd: () => onPickerOpenChange(true),
        disabled: locked,
        disabledReason: lockedReason,
        render: button => (
          <StaffOrPersonPicker
            staff={availableUsers}
            people={availableContacts}
            onSelect={onAdd}
            trigger={button}
            open={isPickerOpen}
            onOpenChange={onPickerOpenChange}
            disabled={disabled}
            disabledReason={disabledReason}
            isPending={isPending}
            onCreatePerson={onCreateContact}
          />
        ),
      }}
      isEmpty={closers.length === 0 && pendingRemovals.length === 0}
      emptyMessage='No closer.'
    >
      {removals.rows.map(({ item: closer, pending }) => {
        const key = closerKey(closer)
        return (
          <SheetRecordRow
            key={key}
            // A closer is a person, staff or not, like the originator.
            icon={ENTITY_ICONS.contact}
            title={closer.name}
            pendingRemoval={
              pending
                ? { disabled: locked, onUndo: () => onAdd(closer) }
                : undefined
            }
            description={
              closer.email && closer.email !== closer.name ? closer.email : null
            }
            fields={
              isSplit ? (
                <RecordRowField label='Share'>
                  <div className='relative -ml-2 w-20 shrink-0'>
                    <Input
                      value={closer.shareText}
                      onChange={event => onShareChange(key, event.target.value)}
                      inputMode='decimal'
                      aria-label={`${closer.name} share`}
                      aria-invalid={hasError || undefined}
                      disabled={locked}
                      className={cn(
                        RECORD_ROW_INPUT_CLASS,
                        'pr-6 text-right tabular-nums'
                      )}
                    />
                    <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-sm'>
                      %
                    </span>
                  </div>
                </RecordRowField>
              ) : undefined
            }
            actions={
              <DisabledFieldTooltip disabled={locked} reason={lockedReason}>
                <RowActionButton
                  type='button'
                  label={`Remove closer ${closer.name}`}
                  icon={<X />}
                  className='text-muted-foreground hover:text-destructive shrink-0'
                  onClick={() => {
                    removals.markRemoved(closer)
                    onRemove(key)
                  }}
                  disabled={locked}
                />
              </DisabledFieldTooltip>
            }
          />
        )
      })}
    </EntityList>
  )
}
