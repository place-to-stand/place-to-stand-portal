'use client'

import { useState } from 'react'
import { Star, X } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { CompanyLinkPicker } from '@/components/companies/company-link-picker'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { CompanyRecordRow } from '@/components/sheets/entity-record-rows'
import { MembershipTitleInput } from '@/components/sheets/membership-title-input'
import { SectionAddButton } from '@/components/sheets/section-add-button'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import { SheetSection } from '@/components/sheets/sheet-section'
import { roleCan } from '@/lib/auth/capabilities'
import type { ContactCompanyEntry } from '@/lib/settings/contacts/use-contact-sheet-state'

type ContactCompaniesSectionProps = {
  companies: ContactCompanyEntry[]
  disabled: boolean
  /** Companies failed to load: show that instead of an empty list. */
  loadFailed?: boolean
  onChange: (companies: ContactCompanyEntry[]) => void
}

/**
 * The companies a person belongs to: title at each and the primary-contact
 * star (set on the company sheet, read-only here). Portal access is set on
 * the client (Edit client > Portal access), not here. All staged until
 * Save, like the rest of the sheet.
 * The first one is their main company in lists.
 */
export function ContactCompaniesSection({
  companies,
  disabled: disabledProp,
  loadFailed = false,
  onChange,
}: ContactCompaniesSectionProps) {
  // A failed load must not look like "no companies": block edits until reopened.
  const disabled = disabledProp || loadFailed
  const { role } = useViewerAccess()
  const canManageAccess = Boolean(role && roleCan(role, 'clients.manage'))
  const [pickerOpen, setPickerOpen] = useState(false)

  const update = (companyId: string, patch: Partial<ContactCompanyEntry>) =>
    onChange(
      companies.map(entry =>
        entry.companyId === companyId ? { ...entry, ...patch } : entry
      )
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
                  clientId: null,
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
            return (
              <CompanyRecordRow
                key={entry.companyId}
                company={{ id: entry.companyId, name: entry.companyName }}
                className={entry.archived ? 'opacity-60' : undefined}
                titleAddon={
                  entry.clientId && !entry.archived ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant='secondary' className='text-xs'>
                          Client
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        Client: {entry.clientName ?? name}
                      </TooltipContent>
                    </Tooltip>
                  ) : null
                }
                note={
                  entry.archived ? (
                    'Archived'
                  ) : entry.isPrimary ? (
                    <span className='inline-flex items-center gap-1'>
                      <Star className='text-warning size-3 fill-current' />
                      Primary contact
                    </span>
                  ) : undefined
                }
                actions={
                  <>
                    <MembershipTitleInput
                      value={entry.title}
                      onChange={title => update(entry.companyId, { title })}
                      ariaLabel={`Title at ${name}`}
                      disabled={disabled}
                    />
                    <RowActionButton
                      type='button'
                      label={`Remove from ${name}`}
                      icon={<X />}
                      className='text-muted-foreground hover:text-destructive'
                      disabled={
                        disabled ||
                        (Boolean(entry.clientId) && !canManageAccess)
                      }
                      onClick={() =>
                        onChange(
                          companies.filter(
                            other => other.companyId !== entry.companyId
                          )
                        )
                      }
                    />
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
