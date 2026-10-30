'use client'

import { useState } from 'react'
import { Star, X } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { CompanyLinkPicker } from '@/components/companies/company-link-picker'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { CompanyRecordRow } from '@/components/sheets/entity-record-rows'
import { ClientBadge } from '@/components/clients/client-badge'
import { MembershipTitleInput } from '@/components/sheets/membership-title-input'
import { SectionAddButton } from '@/components/sheets/section-add-button'
import {
  RecordRowField,
  SheetRecordList,
} from '@/components/sheets/sheet-record-row'
import { SheetSection } from '@/components/sheets/sheet-section'
import { SaveSideEffect } from '@/components/sheets/save-side-effect'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { CLIENT_PRIMARY_ADMIN_ONLY } from '@/lib/companies/people-copy'
import { PENDING_REASON } from '@/lib/forms/form-controls'
import {
  PortalAccessControl,
  type PortalAccessPerson,
} from '@/components/clients/portal-access-control'
import { canSeePortalAccess } from '@/lib/settings/contacts/portal-visibility'
import type { ContactCompanyEntry } from '@/lib/settings/contacts/use-contact-sheet-state'

type ContactCompaniesSectionProps = {
  companies: ContactCompanyEntry[]
  disabled: boolean
  /** Companies failed to load: show that instead of an empty list. */
  loadFailed?: boolean
  onChange: (companies: ContactCompanyEntry[]) => void
  /**
   * Portal switches on client rows (people who manage clients only); null
   * hides them.
   */
  portal?: {
    person: PortalAccessPerson
    /** The Sign-in fields give them a sign-in in this Save. */
    signInStaged: boolean
    /** Portal access as loaded, by company id. */
    savedAccess: Record<string, boolean>
    disabled: boolean
  } | null
}

/**
 * The companies a person belongs to: title at each and the primary-contact
 * star (set on the company sheet, read-only here). People who manage
 * clients get a Portal switch on each client row, the same control as the
 * company's People tab: turning it on for someone with no sign-in gives
 * them a Client sign-in on Save. All staged until Save, like the rest of
 * the sheet. The first one is their main company in lists.
 */
export function ContactCompaniesSection({
  companies,
  disabled: disabledProp,
  loadFailed = false,
  onChange,
  portal = null,
}: ContactCompaniesSectionProps) {
  // A failed load must not look like "no companies": block edits until reopened.
  const disabled = disabledProp || loadFailed
  const { role } = useViewerAccess()
  // Portal access shows only to people who manage clients.
  const canManageAccess = canSeePortalAccess(role)
  const [pickerOpen, setPickerOpen] = useState(false)

  const update = (companyId: string, patch: Partial<ContactCompanyEntry>) =>
    onChange(
      companies.map(entry =>
        entry.companyId === companyId ? { ...entry, ...patch } : entry
      )
    )

  // A client row, or a former client's (its switch shows as it is: access
  // returns with billing, and it can only go off).
  const showsPortal = (entry: ContactCompanyEntry) =>
    portal !== null &&
    ((Boolean(entry.clientCompanyId) && !entry.archived) ||
      Boolean(entry.formerClient))
  const invited =
    portal !== null &&
    !portal.person.hasSignIn &&
    !portal.signInStaged &&
    companies.some(
      entry =>
        showsPortal(entry) &&
        !entry.formerClient &&
        entry.portalAccess &&
        !portal.savedAccess[entry.companyId]
    )

  return (
    <SheetSection
      title='Companies'
      action={
        disabled ? (
          <SectionAddButton label='Add company' disabled />
        ) : (
          <CompanyLinkPicker
            value={null}
            onChange={picked => {
              if (!picked) return
              onChange([
                ...companies,
                {
                  companyId: picked.id,
                  companyName: picked.name,
                  title: '',
                  isPrimary: false,
                  portalAccess: false,
                  clientCompanyId: null,
                  clientName: null,
                },
              ])
            }}
            excludeIds={companies.map(entry => entry.companyId)}
            trigger={<SectionAddButton label='Add company' />}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
          />
        )
      }
    >
      {loadFailed ? (
        <EmptyState message="Couldn't load this person's companies. Close and reopen the sheet to edit them." />
      ) : companies.length === 0 ? (
        <EmptyState
          message='Not at any company yet. Add one or create it.'
          label={disabled ? undefined : 'Add company'}
          onClick={disabled ? undefined : () => setPickerOpen(true)}
        />
      ) : (
        <SheetRecordList>
          {[
            ...companies.filter(entry => !entry.archived),
            ...companies.filter(entry => entry.archived),
          ].map(entry => {
            const name = entry.companyName || 'this company'
            // A client's primary contact is its invoice recipient: leaving
            // it is for people who manage clients (the server agrees).
            const primaryLocked =
              !canManageAccess &&
              entry.isPrimary &&
              Boolean(entry.clientCompanyId) &&
              !entry.archived
            return (
              <CompanyRecordRow
                key={entry.companyId}
                company={{ id: entry.companyId, name: entry.companyName }}
                className={entry.archived ? 'opacity-60' : undefined}
                titleAddon={
                  entry.clientCompanyId && !entry.archived ? (
                    <ClientBadge />
                  ) : null
                }
                note={
                  entry.formerClient && portal ? (
                    'Portal access returns if billing restarts.'
                  ) : entry.archived ? (
                    'Archived'
                  ) : entry.isPrimary ||
                    (canManageAccess &&
                      entry.clientCompanyId &&
                      entry.portalAccess) ? (
                    <span className='inline-flex items-center gap-2'>
                      {entry.isPrimary ? (
                        <span className='inline-flex items-center gap-1'>
                          <Star className='text-warning size-3 fill-current' />
                          Primary contact
                        </span>
                      ) : null}
                      {canManageAccess &&
                      entry.clientCompanyId &&
                      entry.portalAccess ? (
                        <span>Portal access</span>
                      ) : null}
                    </span>
                  ) : undefined
                }
                fields={
                  <>
                    <RecordRowField label='Title'>
                      <MembershipTitleInput
                        value={entry.title}
                        onChange={title => update(entry.companyId, { title })}
                        ariaLabel={`Title at ${name}`}
                        disabled={disabled}
                      />
                    </RecordRowField>
                    {portal && showsPortal(entry) ? (
                      <RecordRowField label='Portal'>
                        <PortalAccessControl
                          showLabel={false}
                          person={{
                            ...portal.person,
                            hasSignIn: portal.signInStaged
                              ? null
                              : portal.person.hasSignIn,
                          }}
                          hasAccess={entry.portalAccess}
                          disabled={
                            disabled ||
                            portal.disabled ||
                            (Boolean(entry.formerClient) && !entry.portalAccess)
                          }
                          disabledReason={
                            disabled || portal.disabled
                              ? PENDING_REASON
                              : 'Bill this company before giving its people portal access.'
                          }
                          onChange={on =>
                            update(entry.companyId, { portalAccess: on })
                          }
                        />
                      </RecordRowField>
                    ) : null}
                  </>
                }
                actions={
                  <>
                    <DisabledFieldTooltip
                      disabled={!disabled && primaryLocked}
                      reason={primaryLocked ? CLIENT_PRIMARY_ADMIN_ONLY : null}
                      className='w-auto'
                    >
                      <RowActionButton
                        type='button'
                        label={`Remove from ${name}`}
                        icon={<X />}
                        className='text-muted-foreground hover:text-destructive'
                        disabled={disabled || primaryLocked}
                        onClick={() =>
                          onChange(
                            companies.filter(
                              other => other.companyId !== entry.companyId
                            )
                          )
                        }
                      />
                    </DisabledFieldTooltip>
                  </>
                }
              />
            )
          })}
        </SheetRecordList>
      )}
      {invited ? (
        <SaveSideEffect>
          Saving emails a portal invite to {portal!.person.name}.
        </SaveSideEffect>
      ) : null}
    </SheetSection>
  )
}
