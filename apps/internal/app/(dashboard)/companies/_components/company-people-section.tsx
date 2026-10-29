'use client'

import type { ReactNode } from 'react'
import { ExternalLink, Star, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import {
  ContactLinkPicker,
  type ContactLink,
} from '@/components/contacts/contact-link-picker'
import { SheetSection } from '@/components/sheets/sheet-section'
import { RecordRowButton } from '@/components/ui/record-row-button'
import type { CompanyContactSummary } from '@/lib/companies/types'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
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
  disabled,
  lockedReason,
  onSetPrimary,
  onAdd,
  onRemove,
  onUndoRemove,
}: CompanyPeopleSectionProps) {
  const { open } = useSheetParams()
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
      description={
        lockedReason
          ? `Everyone we know here. ${lockedReason}`
          : 'Everyone we know here. Star the primary contact; clients use them too, e.g. for invoice emails.'
      }
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
        <ul className='-mx-2 space-y-0.5'>
          {contacts.map(contact =>
            removed.has(contact.id) ? (
              <PersonRow
                key={contact.id}
                className='opacity-60'
                onOpen={() => open('contact', contact.id)}
                title={<span className='line-through'>{contact.name}</span>}
                subtitle={<span className='text-destructive'>Pending removal</span>}
              >
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
              </PersonRow>
            ) : (
              <PersonRow
                key={contact.id}
                onOpen={() => open('contact', contact.id)}
                title={contact.name}
                subtitle={contact.jobTitle ?? contact.email}
              >
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
              </PersonRow>
            )
          )}
          {added.map(contact => {
            const from = movesFrom(contact.id)
            return (
              <PersonRow
                key={`added-${contact.id}`}
                onOpen={() => open('contact', contact.id)}
                title={contact.name}
                subtitle={
                  <span className='text-warning'>
                    {from ? `Moves from ${from}` : 'Pending save'}
                  </span>
                }
              >
                {star(contact)}
                {removeButton(contact)}
              </PersonRow>
            )
          })}
        </ul>
      )}
    </SheetSection>
  )
}

function PersonRow({
  title,
  subtitle,
  onOpen,
  className,
  children,
}: {
  title: ReactNode
  subtitle: ReactNode
  onOpen: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <li className={cn('flex items-center gap-1', className)}>
      <RecordRowButton
        variant='inset'
        onClick={onOpen}
        title={title}
        subtitle={subtitle}
      />
      {children}
    </li>
  )
}
