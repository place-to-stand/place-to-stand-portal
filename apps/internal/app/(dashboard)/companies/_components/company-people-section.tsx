'use client'

import { useState, type ReactNode } from 'react'
import { ExternalLink, Star, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import {
  ContactLinkPicker,
  type ContactLink,
} from '@/components/contacts/contact-link-picker'
import { MembershipTitleInput } from '@/components/sheets/membership-title-input'
import { SheetSection } from '@/components/sheets/sheet-section'
import { ContactRecordRow } from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import type { CompanyContactSummary } from '@/lib/companies/types'
import { cn } from '@/lib/utils'

import { SectionAddButton } from '@/components/sheets/section-add-button'

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
  /** "Also at …" for an added person who belongs to another company. */
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
  /** Each contact's title here, by contact id (staged). */
  titles: Record<string, string>
  /** Titles stay editable where the list is locked (as on the contact sheet). */
  titleDisabled: boolean
  onTitleChange: (contactId: string, title: string) => void
  onSetPrimary: (contactId: string | null) => void
  onAdd: (contact: ContactLink) => void
  onRemove: (contactId: string) => void
  onUndoRemove: (contactId: string) => void
  /** A billed company (admins only): each person's portal access switch. */
  portalAccessFor?: ((contactId: string) => ReactNode) | null
  /** One muted line under the list, e.g. who Save will email. */
  footer?: ReactNode
}

/**
 * The company's people. Adding, removing and starring are staged and saved
 * with the sheet; someone added here keeps their other companies.
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
  titles,
  titleDisabled,
  onTitleChange,
  onSetPrimary,
  onAdd,
  onRemove,
  onUndoRemove,
  portalAccessFor = null,
  footer = null,
}: CompanyPeopleSectionProps) {
  const removed = new Set(removedIds)
  const listedIds = [...contacts.map(c => c.id), ...added.map(c => c.id)]
  const isEmpty = contacts.length === 0 && added.length === 0
  const [pickerOpen, setPickerOpen] = useState(false)
  const canAdd = !lockedReason && !disabled

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

  const titleInput = (contact: { id: string; name: string }) => (
    <MembershipTitleInput
      value={titles[contact.id] ?? ''}
      onChange={title => onTitleChange(contact.id, title)}
      ariaLabel={`${contact.name}'s title`}
      disabled={titleDisabled}
    />
  )

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
        !canAdd ? (
          <SectionAddButton label='Add person' disabledReason={lockedReason} />
        ) : (
          <ContactLinkPicker
            value={null}
            onChange={contact => (contact ? onAdd(contact) : undefined)}
            excludeIds={listedIds.filter(id => !removed.has(id))}
            trigger={<SectionAddButton label='Add person' />}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
          />
        )
      }
    >
      {isEmpty ? (
        <EmptyState
          message='No people here yet. Add the ones you know at this company.'
          label={canAdd ? 'Add person' : undefined}
          onClick={canAdd ? () => setPickerOpen(true) : undefined}
        />
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
                    {portalAccessFor?.(contact.id)}
                    {titleInput(contact)}
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
                    {from ? `Joins on save · also at ${from}` : 'Joins on save'}
                  </span>
                }
                actions={
                  <>
                    {portalAccessFor?.(contact.id)}
                    {titleInput(contact)}
                    {star(contact)}
                    {removeButton(contact)}
                  </>
                }
              />
            )
          })}
        </SheetRecordList>
      )}
      {footer}
    </SheetSection>
  )
}
