'use client'

import { X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { RowActionButton } from '@pts/ui/row-action-button'
import { SheetRecordRow } from '@/components/sheets/sheet-record-row'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'

import type {
  OriginationContactOption,
  PartnerUserOption,
} from '@/lib/companies/billing/use-client-sheet-state'
import { ENTITY_ICONS } from '@/lib/entity-accents'

import {
  StaffOrPersonPicker,
  type StaffOrPersonCandidate,
} from './staff-or-person-picker'

export type ClientOriginationPickerProps = {
  selectedUser: PartnerUserOption | null
  selectedContact: OriginationContactOption | null
  availableUsers: PartnerUserOption[]
  availableContacts: OriginationContactOption[]
  disabled: boolean
  disabledReason: string | null
  isPickerOpen: boolean
  isPending: boolean
  pendingReason: string
  onPickerOpenChange: (open: boolean) => void
  onSelectUser: (user: PartnerUserOption) => void
  onSelectContact: (contact: OriginationContactOption) => void
  onClear: () => void
  /** Open the contact create sheet; the new contact becomes the originator. */
  onCreateContact: (query: string) => void
}

type OriginatorCandidate = StaffOrPersonCandidate & { pick: () => void }

function userCandidate(
  user: PartnerUserOption,
  onSelect: (user: PartnerUserOption) => void
): OriginatorCandidate {
  return {
    kind: 'user',
    id: user.id,
    name: user.fullName?.trim() || user.email,
    email: user.email,
    pick: () => onSelect(user),
  }
}

function contactCandidate(
  contact: OriginationContactOption,
  onSelect: (contact: OriginationContactOption) => void
): OriginatorCandidate {
  return {
    kind: 'contact',
    id: contact.id,
    name: contact.name?.trim() || contact.email || 'Unnamed person',
    email: contact.email,
    pick: () => onSelect(contact),
  }
}

/**
 * The client's single originator — an admin or a contact, picked from one
 * list the same way closers are. The selection itself says which kind it is.
 */
export function ClientOriginationPicker({
  selectedUser,
  selectedContact,
  availableUsers,
  availableContacts,
  disabled,
  disabledReason,
  isPickerOpen,
  isPending,
  pendingReason,
  onPickerOpenChange,
  onSelectUser,
  onSelectContact,
  onClear,
  onCreateContact,
}: ClientOriginationPickerProps) {
  const selected = selectedUser
    ? userCandidate(selectedUser, onSelectUser)
    : selectedContact
      ? contactCandidate(selectedContact, onSelectContact)
      : null

  if (selected) {
    const locked = isPending || disabled
    return (
      <SheetRecordRow
        icon={ENTITY_ICONS.contact}
        title={selected.name}
        description={
          selected.email && selected.email !== selected.name
            ? selected.email
            : null
        }
        actions={
          <DisabledFieldTooltip
            disabled={locked}
            reason={isPending ? pendingReason : disabledReason}
          >
            <RowActionButton
              type='button'
              label={`Remove originator ${selected.name}`}
              icon={<X />}
              className='text-muted-foreground hover:text-destructive shrink-0'
              onClick={onClear}
              disabled={locked}
            />
          </DisabledFieldTooltip>
        }
      />
    )
  }

  return (
    <StaffOrPersonPicker
      staff={availableUsers.map(user => userCandidate(user, onSelectUser))}
      people={availableContacts.map(contact =>
        contactCandidate(contact, onSelectContact)
      )}
      onSelect={candidate => candidate.pick()}
      trigger={
        <Button
          type='button'
          variant='outline'
          className='w-full justify-start'
          disabled={disabled}
        >
          <ENTITY_ICONS.contact className='h-4 w-4' />
          No originator
        </Button>
      }
      triggerClassName='w-full'
      open={isPickerOpen}
      onOpenChange={onPickerOpenChange}
      disabled={disabled}
      disabledReason={disabledReason}
      isPending={isPending}
      onCreatePerson={onCreateContact}
    />
  )
}
