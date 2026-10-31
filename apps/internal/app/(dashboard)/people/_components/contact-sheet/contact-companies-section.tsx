'use client'

import { useState } from 'react'
import { Star, X } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'
import { Switch } from '@pts/ui/switch'
import { RowActionButton } from '@pts/ui/row-action-button'
import { CompanyLinkPicker } from '@/components/companies/company-link-picker'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { CompanyRecordRow } from '@/components/sheets/entity-record-rows'
import { CompanyBillingMark } from '@/components/billing/company-billing-mark'
import { MembershipTitleInput } from '@/components/sheets/membership-title-input'
import { RecordRowField } from '@/components/sheets/sheet-record-row'
import { EntityList } from '@/components/sheets/entity-list'
import { usePendingRemovals } from '@/components/sheets/use-pending-removals'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { CLIENT_PRIMARY_ADMIN_ONLY } from '@/lib/companies/people-copy'
import { canSeePortalAccess } from '@/lib/settings/contacts/portal-visibility'
import type { ContactCompanyEntry } from '@/lib/settings/contacts/use-contact-sheet-state'

type ContactCompaniesSectionProps = {
  companies: ContactCompanyEntry[]
  disabled: boolean
  /** Companies failed to load: show that instead of an empty list. */
  loadFailed?: boolean
  onChange: (companies: ContactCompanyEntry[]) => void
  /**
   * Notes which client rows have portal access (people who manage clients
   * only). The sheet's Access section changes it, not this list.
   */
  showPortalAccess?: boolean
  /**
   * Why the portal switches are off, if they are: portal access needs a
   * client portal sign-in (Access).
   */
  portalReason?: string | null
}

/**
 * The companies a person belongs to: title at each and the primary-contact
 * star (set on the company sheet, read-only here). Portal access shows as a
 * note on a client row; the Access section changes it. All staged until
 * Save, like the rest of the sheet. The first one is their main company in
 * lists.
 */
export function ContactCompaniesSection({
  companies,
  disabled: disabledProp,
  loadFailed = false,
  onChange,
  showPortalAccess = false,
  portalReason = null,
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

  // Removed companies stay as Pending removal, with Undo, until Save.
  const removals = usePendingRemovals<ContactCompanyEntry>(companyEntryKey, [
    ...companies.filter(entry => !entry.archived),
    ...companies.filter(entry => entry.archived),
  ])

  return (
    <EntityList
      title='Companies'
      add={{
        label: 'Add company',
        onAdd: () => setPickerOpen(true),
        disabled,
        render: button => (
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
            trigger={button}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
          />
        ),
      }}
      isEmpty={companies.length === 0 && removals.pending.length === 0}
      emptyMessage='Not at any company yet. Add one or create it.'
      status={
        loadFailed ? (
          <EmptyState message="Couldn't load this person's companies. Close and reopen the sheet to edit them." />
        ) : undefined
      }
    >
      {removals.rows.map(({ item: entry, pending }) => {
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
            pendingRemoval={
              pending
                ? {
                    disabled,
                    onUndo: () => onChange([...companies, entry]),
                  }
                : undefined
            }
            className={entry.archived ? 'opacity-60' : undefined}
            titleAddon={
              entry.clientCompanyId && !entry.archived ? (
                <CompanyBillingMark billingType={entry.billingType} />
              ) : null
            }
            note={
              entry.formerClient && showPortalAccess
                ? 'Portal access returns if billing restarts.'
                : entry.archived
                  ? 'Archived'
                  : undefined
            }
            fields={
              <>
                <RecordRowField label='Title' grow>
                  <MembershipTitleInput
                    value={entry.title}
                    onChange={title => update(entry.companyId, { title })}
                    ariaLabel={`Title at ${name}`}
                    disabled={disabled}
                  />
                </RecordRowField>
                {showPortalAccess &&
                entry.clientCompanyId &&
                !entry.archived ? (
                  <RecordRowField
                    label='Portal access'
                    hint={!disabled && portalReason ? portalReason : null}
                  >
                    <Switch
                      checked={entry.portalAccess}
                      disabled={disabled || Boolean(portalReason)}
                      aria-label={`Portal access at ${name}`}
                      onCheckedChange={portalAccess =>
                        update(entry.companyId, { portalAccess })
                      }
                    />
                  </RecordRowField>
                ) : null}
              </>
            }
            actions={
              <>
                {/* Where the company sheet puts its primary star. */}
                {entry.isPrimary ? (
                  <span className='text-muted-foreground mr-1 flex h-8 items-center gap-1.5 text-xs'>
                    <Star
                      className='text-warning size-4 fill-current'
                      aria-hidden
                    />
                    Primary contact
                  </span>
                ) : null}
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
                    onClick={() => {
                      removals.markRemoved(entry)
                      onChange(
                        companies.filter(
                          other => other.companyId !== entry.companyId
                        )
                      )
                    }}
                  />
                </DisabledFieldTooltip>
              </>
            }
          />
        )
      })}
    </EntityList>
  )
}

const companyEntryKey = (entry: { companyId: string }) => entry.companyId
