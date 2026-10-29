'use client'

import { ExternalLink, Star, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import {
  ContactLinkPicker,
  type ContactLink,
} from '@/components/contacts/contact-link-picker'
import { SheetSection } from '@/components/sheets/sheet-section'
import { ContactRecordRow } from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import type { CompanyContactSummary } from '@/lib/companies/types'
import { cn } from '@/lib/utils'

import { SectionAddButton } from './section-add-button'

/** Someone picked on the People list, joining the company on Save. */
export type StagedPerson = {
  id: string
  name: string
  email: string | null
}

type CompanyPeopleSectionProps = {
  contacts: CompanyContactSummary[]
  added: StagedPerson[]
  removedIds: string[]
  /** "Moves from …" for an added person who works somewhere else now. */
  movesFrom: (contactId: string) => string | null
  /** The form's current choice, so the star follows unsaved edits. */
  primaryContactId: string | null
  /** The company's client, if any: removing someone ends their access to it. */
  clientName?: string | null
  disabled: boolean
  /**
   * Why the list is locked (a client company, for a non-admin), shown on the
   * Add button and in the description. Null when it isn't.
   */
  lockedReason: string | null
  onSetPrimary: (contactId: string | null) => void
  onAdd: (contact: ContactLink) => void
  onRemove: (contactId: string) => void
  onUndoRemove: (contactId: string) => void
}

/**
 * The company's people. Adding, removing and starring are staged and saved
 * with the sheet; adding someone from another company moves them here.
 */
export function CompanyPeopleSection({
  contacts,
  added,
  removedIds,
  movesFrom,
  primaryContactId,
  clientName = null,
  disabled,
  lockedReason,
  onSetPrimary,
  onAdd,
  onRemove,
  onUndoRemove,
}: CompanyPeopleSectionProps) {
  const removed = new Set(removedIds)
  const listedIds = [...contacts.map(c => c.id), ...added.map(c => c.id)]
  const isEmpty = contacts.length === 0 && added.length === 0

  const star = (contact: { id: string; name: string }) => {
    const isPrimary = contact.id === primaryContactId
    return (
      <RowActionButton
        type='button'
        disabled={disabled}
        aria-pressed={isPrimary}
        label={
          isPrimary
            ? `Remove ${contact.name} as primary contact`
            : `Make ${contact.name} the primary contact`
        }
        onClick={() => onSetPrimary(isPrimary ? null : contact.id)}
        className={cn(
          'text-muted-foreground',
          isPrimary && 'text-warning hover:text-warning'
        )}
        icon={<Star className={cn(isPrimary && 'fill-current')} />}
      />
    )
  }

  const removeButton = (contact: { id: string; name: string }) => (
    <RowActionButton
      type='button'
      disabled={disabled}
      label={`Remove ${contact.name} from this company`}
      onClick={() => onRemove(contact.id)}
      className='text-muted-foreground hover:text-destructive'
      icon={<X />}
    />
  )

  return (
    <SheetSection
      title='People'
      action={
        lockedReason || disabled ? (
          <SectionAddButton label='Add person' disabledReason={lockedReason} />
        ) : (
          <ContactLinkPicker
            value={null}
            onChange={contact => (contact ? onAdd(contact) : undefined)}
            excludeIds={listedIds.filter(id => !removed.has(id))}
            trigger={<SectionAddButton label='Add person' />}
          />
        )
      }
    >
      {isEmpty ? (
        <EmptyState message='No one here yet. Add the people you know at this company.' />
      ) : (
        <SheetRecordList>
          {contacts.map(contact =>
            removed.has(contact.id) ? (
              <ContactRecordRow
                key={contact.id}
                contact={contact}
                className='opacity-60'
                note={
                  <span className='text-destructive'>
                    {clientName
                      ? `Pending removal · loses portal access to ${clientName}`
                      : 'Pending removal'}
                  </span>
                }
                actions={
                  <Button
                    type='button'
                    variant='ghost'
                    size='xs'
                    className='text-muted-foreground'
                    disabled={disabled}
                    onClick={() => onUndoRemove(contact.id)}
                    aria-label={`Undo removing ${contact.name}`}
                  >
                    Undo
                  </Button>
                }
              />
            ) : (
              <ContactRecordRow
                key={contact.id}
                contact={contact}
                actions={
                  <>
                    {contact.linkedinUrl ? (
                      <RowActionButton
                        type='button'
                        label={`${contact.name} on LinkedIn`}
                        icon={<ExternalLink />}
                        onClick={() =>
                          window.open(
                            contact.linkedinUrl ?? '',
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }
                      />
                    ) : null}
                    {star(contact)}
                    {removeButton(contact)}
                  </>
                }
              />
            )
          )}
          {added.map(contact => {
            const from = movesFrom(contact.id)
            return (
              <ContactRecordRow
                key={`added-${contact.id}`}
                contact={contact}
                note={
                  <span className='text-warning'>
                    {from ? `Moves from ${from}` : 'Pending save'}
                  </span>
                }
                actions={
                  <>
                    {star(contact)}
                    {removeButton(contact)}
                  </>
                }
              />
            )
          })}
        </SheetRecordList>
      )}
    </SheetSection>
  )
}
