'use client'

import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { RowActionButton } from '@pts/ui/row-action-button'
import {
  ContactLinkPicker,
  type ContactLink,
} from '@/components/contacts/contact-link-picker'
import { MembershipTitleInput } from '@/components/sheets/membership-title-input'
import { EntityList } from '@/components/sheets/entity-list'
import { ContactRecordRow } from '@/components/sheets/entity-record-rows'
import { PrimaryContactToggle } from '@/components/sheets/primary-contact-toggle'
import { RecordRowField } from '@/components/sheets/sheet-record-row'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { SiteMark } from '@/components/ui/site-mark'
import { toSafeHref } from '@/components/ui/url-input'
import { SIGN_IN_COMPANIES_ADMIN_ONLY } from '@/lib/companies/people-copy'
import type { CompanyContactSummary } from '@/lib/companies/types'

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
   * Why the list is locked (the staff company, for a non-admin), shown on
   * the Add button. Null when it isn't.
   */
  lockedReason: string | null
  /**
   * Why the primary contact can't change (a client, for someone who can't
   * manage clients): the star, and removing the saved primary, are off.
   */
  primaryLockedReason?: string | null
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
  /** What Save does with a person's portal access, beside the switch. */
  portalHintFor?: ((contactId: string) => ReactNode) | null
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
  primaryLockedReason = null,
  titles,
  titleDisabled,
  onTitleChange,
  onSetPrimary,
  onAdd,
  onRemove,
  onUndoRemove,
  portalAccessFor = null,
  portalHintFor = null,
  footer = null,
}: CompanyPeopleSectionProps) {
  const removed = new Set(removedIds)
  const listedIds = [...contacts.map(c => c.id), ...added.map(c => c.id)]
  const isEmpty = contacts.length === 0 && added.length === 0
  const [pickerOpen, setPickerOpen] = useState(false)

  const star = (contact: { id: string; name: string }) => {
    const isPrimary = contact.id === primaryContactId
    return (
      <DisabledFieldTooltip
        disabled={!disabled && Boolean(primaryLockedReason)}
        reason={primaryLockedReason}
        className='w-auto'
      >
        <PrimaryContactToggle
          name={contact.name}
          isPrimary={isPrimary}
          hasPrimary={primaryContactId !== null}
          disabled={disabled || Boolean(primaryLockedReason)}
          onToggle={() => onSetPrimary(isPrimary ? null : contact.id)}
        />
      </DisabledFieldTooltip>
    )
  }

  // The row's fields line: Title, then Portal (admins, billed companies).
  const fields = (contact: { id: string; name: string }) => {
    const portal = portalAccessFor?.(contact.id) ?? null
    return (
      <>
        <RecordRowField label='Title' grow>
          <MembershipTitleInput
            value={titles[contact.id] ?? ''}
            onChange={title => onTitleChange(contact.id, title)}
            ariaLabel={`${contact.name}'s title`}
            disabled={titleDisabled}
          />
        </RecordRowField>
        {portal ? (
          <RecordRowField
            label='Portal access'
            hint={portalHintFor?.(contact.id) ?? null}
          >
            {portal}
          </RecordRowField>
        ) : null}
      </>
    )
  }

  // Shown only for a link a LinkedIn field would open (`toSafeHref`).
  const linkedinButton = (contact: {
    name: string
    linkedinUrl?: string | null
  }) => {
    const href = toSafeHref(contact.linkedinUrl)
    if (!href) return null
    return (
      <RowActionButton
        type='button'
        label={`Open ${contact.name}'s LinkedIn`}
        icon={<SiteMark href={href} />}
        className='text-muted-foreground'
        onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
      />
    )
  }

  const removeButton = (contact: {
    id: string
    name: string
    isPrimary?: boolean
    signInLocked?: boolean
  }) => {
    // Removing the saved primary ends them being primary.
    const reason = contact.signInLocked
      ? SIGN_IN_COMPANIES_ADMIN_ONLY
      : contact.isPrimary
        ? primaryLockedReason
        : null
    return (
      <DisabledFieldTooltip
        disabled={!disabled && Boolean(reason)}
        reason={reason}
        className='w-auto'
      >
        <RowActionButton
          type='button'
          disabled={disabled || Boolean(reason)}
          label={`Remove ${contact.name} from this company`}
          onClick={() => onRemove(contact.id)}
          className='text-muted-foreground hover:text-destructive'
          icon={<X />}
        />
      </DisabledFieldTooltip>
    )
  }

  return (
    <EntityList
      title='People'
      add={{
        label: 'Add person',
        onAdd: () => setPickerOpen(true),
        disabled,
        disabledReason: lockedReason,
        render: button => (
          <ContactLinkPicker
            value={null}
            onChange={contact => (contact ? onAdd(contact) : undefined)}
            excludeIds={listedIds.filter(id => !removed.has(id))}
            trigger={button}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
          />
        ),
      }}
      isEmpty={isEmpty}
      emptyMessage='No people here yet. Add the ones you know at this company.'
      footer={footer}
    >
      {contacts.map(contact =>
        removed.has(contact.id) ? (
          <ContactRecordRow
            key={contact.id}
            contact={contact}
            hasSignIn={contact.hasPortalLogin && !contact.signInDisabled}
            pendingRemoval={{
              disabled,
              note: clientName
                ? `Pending removal · loses portal access to ${clientName}`
                : undefined,
              onUndo: () => onUndoRemove(contact.id),
            }}
          />
        ) : (
          <ContactRecordRow
            key={contact.id}
            contact={contact}
            hasSignIn={contact.hasPortalLogin && !contact.signInDisabled}
            fields={fields(contact)}
            actions={
              <>
                {/* Star first: hidden on most cards, its space sits at the
                    left end instead of between LinkedIn and remove. */}
                {star(contact)}
                {linkedinButton(contact)}
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
            fields={fields(contact)}
            actions={
              <>
                {star(contact)}
                {removeButton(contact)}
              </>
            }
          />
        )
      })}
    </EntityList>
  )
}
