'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { RowActionButton } from '@pts/ui/row-action-button'
import { EntityList } from '@/components/sheets/entity-list'
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
    hasPhoto: user.hasPhoto,
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
    hasPhoto: contact.hasPhoto,
    pick: () => onSelect(contact),
  }
}

/**
 * The client's single originator, as an entity list: the + opens one picker
 * of staff and people; one card once set (the + hides, since there is only
 * one). Removing it leaves a "Pending removal" card with Undo until Save.
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
  // What was just removed, so Undo can put it back before Save.
  const [removed, setRemoved] = useState<OriginatorCandidate | null>(null)
  const selected = selectedUser
    ? userCandidate(selectedUser, onSelectUser)
    : selectedContact
      ? contactCandidate(selectedContact, onSelectContact)
      : null
  const locked = isPending || disabled
  const lockedReason = isPending ? pendingReason : disabledReason
  const pendingRemoval = !selected ? removed : null

  return (
    <EntityList
      title='Origination'
      add={
        selected
          ? undefined
          : {
              label: 'Add originator',
              onAdd: () => onPickerOpenChange(true),
              disabled: locked,
              disabledReason: lockedReason,
              render: button => (
                <StaffOrPersonPicker
                  staff={availableUsers.map(user =>
                    userCandidate(user, onSelectUser)
                  )}
                  people={availableContacts.map(contact =>
                    contactCandidate(contact, onSelectContact)
                  )}
                  onSelect={candidate => {
                    setRemoved(null)
                    candidate.pick()
                  }}
                  trigger={button}
                  open={isPickerOpen}
                  onOpenChange={onPickerOpenChange}
                  disabled={disabled}
                  disabledReason={disabledReason}
                  isPending={isPending}
                  onCreatePerson={onCreateContact}
                />
              ),
            }
      }
      isEmpty={!selected && !pendingRemoval}
      emptyMessage='No originator.'
    >
      {selected ? (
        <SheetRecordRow
          icon={ENTITY_ICONS.contact}
          title={selected.name}
          description={
            selected.email && selected.email !== selected.name
              ? selected.email
              : null
          }
          actions={
            <DisabledFieldTooltip disabled={locked} reason={lockedReason}>
              <RowActionButton
                type='button'
                label={`Remove originator ${selected.name}`}
                icon={<X />}
                className='text-muted-foreground hover:text-destructive shrink-0'
                onClick={() => {
                  setRemoved(selected)
                  onClear()
                }}
                disabled={locked}
              />
            </DisabledFieldTooltip>
          }
        />
      ) : pendingRemoval ? (
        <SheetRecordRow
          icon={ENTITY_ICONS.contact}
          className='opacity-60'
          title={pendingRemoval.name}
          description={
            <span className='text-destructive'>Pending removal</span>
          }
          actions={
            <Button
              type='button'
              variant='ghost'
              size='xs'
              className='text-muted-foreground'
              disabled={locked}
              onClick={() => {
                setRemoved(null)
                pendingRemoval.pick()
              }}
              aria-label={`Undo removing ${pendingRemoval.name}`}
            >
              Undo
            </Button>
          }
        />
      ) : null}
    </EntityList>
  )
}
