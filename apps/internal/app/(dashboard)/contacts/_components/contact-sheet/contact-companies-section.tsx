'use client'

import { useState } from 'react'
import { Star, X } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { Switch } from '@pts/ui/switch'
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
  onChange: (companies: ContactCompanyEntry[]) => void
}

/**
 * The companies a person belongs to: title at each, the primary-contact
 * star (set on the company sheet, read-only here) and portal access to the
 * company's client. All staged until Save, like the rest of the sheet.
 * The first one is their main company in lists.
 */
export function ContactCompaniesSection({
  companies,
  disabled,
  onChange,
}: ContactCompaniesSectionProps) {
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
          <SectionAddButton label='Link company' disabled />
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
            trigger={<SectionAddButton label='Link company' />}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
          />
        )
      }
    >
      {companies.length === 0 ? (
        <EmptyState
          message='Not at any company yet. Link one or create it.'
          label={disabled ? undefined : 'Link company'}
          onClick={disabled ? undefined : () => setPickerOpen(true)}
        />
      ) : (
        <SheetRecordList>
          {companies.map(entry => {
            const name = entry.companyName || 'this company'
            const accessLocked = disabled || !canManageAccess
            return (
              <CompanyRecordRow
                key={entry.companyId}
                company={{ id: entry.companyId, name: entry.companyName }}
                note={
                  entry.isPrimary ? (
                    <span className='inline-flex items-center gap-1'>
                      <Star className='text-warning size-3 fill-current' />
                      Primary contact
                    </span>
                  ) : entry.clientName ? (
                    `Client: ${entry.clientName}`
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
                    {entry.clientId ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className='inline-flex px-2'>
                            <Switch
                              checked={entry.portalAccess}
                              disabled={accessLocked}
                              aria-label={`Portal access to ${entry.clientName ?? name}`}
                              onCheckedChange={checked =>
                                update(entry.companyId, {
                                  portalAccess: checked,
                                })
                              }
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {canManageAccess
                            ? `Portal access to ${entry.clientName ?? name}`
                            : 'Only an admin can change portal access.'}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
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
