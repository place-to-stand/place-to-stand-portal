'use client'

import { useMemo } from 'react'
import { useController, useWatch, type Control } from 'react-hook-form'

import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { CompanyLinkPicker } from '@/components/companies/company-link-picker'
import {
  ContactLinkPicker,
  useContactOptions,
} from '@/components/contacts/contact-link-picker'

import { SaveSideEffect } from '@/components/sheets/save-side-effect'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@pts/ui/input'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { isSelectableUser } from '@/lib/users/selectable'
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_TYPES,
  LEAD_STATUS_ORDER,
  type LeadSourceTypeValue,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import type { LeadAssigneeOption } from '@/lib/leads/types'

import type { LeadFormValues } from './types'

type LeadSheetFormFieldsProps = {
  control: Control<LeadFormValues>
  assignees: LeadAssigneeOption[]
  selectedSourceType: LeadSourceTypeValue | null | undefined
}

export function LeadSheetFormFields({
  control,
  assignees,
  selectedSourceType,
}: LeadSheetFormFieldsProps) {
  // Disabled admins are not offered, but a lead they already hold keeps
  // them as a disabled entry so the picker still names the assignee.
  const currentAssigneeId = useWatch({ control, name: 'assigneeId' }) ?? null
  // A contact created from here starts at the lead's company.
  const { field: companyField } = useController({ control, name: 'company' })
  const leadCompanyId = companyField.value?.id ?? null
  const assigneeItems = useMemo(
    () => [
      ...assignees
        .filter(
          assignee =>
            isSelectableUser(assignee) || assignee.id === currentAssigneeId
        )
        .map(assignee => ({
          value: assignee.id,
          label: assignee.name,
          description: assignee.email ?? undefined,
          userId: assignee.id,
          avatarUrl: assignee.avatarUrl,
          disabled: !isSelectableUser(assignee),
        })),
    ],
    [assignees, currentAssigneeId]
  )

  return (
    <div className='space-y-6'>
      <FormField
        control={control}
        name='contact'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Person</FormLabel>
            <FormControl>
              <ContactLinkPicker
                value={field.value ?? null}
                onChange={next => {
                  field.onChange(next)
                  // Fill the company from the contact's main company, only
                  // while it's empty: never overwrite one already chosen.
                  if (next?.companyId && !companyField.value) {
                    companyField.onChange({
                      id: next.companyId,
                      name: next.companyName ?? '',
                    })
                  }
                }}
                showCreateButton
                createCompanyId={leadCompanyId}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name='company'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Company</FormLabel>
            <FormControl>
              <CompanyLinkPicker
                value={field.value ?? null}
                onChange={next => field.onChange(next)}
                showCreateButton
              />
            </FormControl>
            <FormMessage />
            <ContactCompanyMismatchNote control={control} />
          </FormItem>
        )}
      />
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='sourceType'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source</FormLabel>
              <Select
                value={field.value ?? 'none'}
                onValueChange={(value: string) =>
                  field.onChange(
                    value === 'none' ? null : (value as LeadSourceTypeValue)
                  )
                }
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder='Select source'>
                      {field.value ? (
                        LEAD_SOURCE_LABELS[field.value]
                      ) : (
                        <span className='text-muted-foreground'>Not set</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='none'>
                    <span className='text-muted-foreground'>Not set</span>
                  </SelectItem>
                  {LEAD_SOURCE_TYPES.map(source => (
                    <SelectItem key={source} value={source}>
                      {LEAD_SOURCE_LABELS[source]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name='sourceDetail'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source info</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  placeholder='Referral name, site URL, or event title'
                  disabled={!selectedSourceType}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='status'
          render={({ field }) => {
            const selectedStatus = LEAD_STATUS_ORDER.find(
              status => status === field.value
            )

            return (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value: LeadStatusValue) =>
                    field.onChange(value)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select status'>
                        {selectedStatus ? (
                          <LeadStatusBadge status={selectedStatus} />
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {LEAD_STATUS_ORDER.map(status => (
                      <SelectItem key={status} value={status}>
                        <LeadStatusBadge status={status} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        <FormField
          control={control}
          name='assigneeId'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assignee</FormLabel>
              <FormControl>
                <SearchableCombobox
                  items={assigneeItems}
                  clearLabel='assignee'
                  value={field.value ?? ''}
                  onChange={value =>
                    field.onChange(value.length ? value : null)
                  }
                  placeholder='Unassigned'
                  searchPlaceholder='Search people…'
                  onClear={() => field.onChange(null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name='notes'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <RichTextEditor
                id='lead-notes'
                value={field.value ?? ''}
                onChange={field.onChange}
                contentMinHeightClassName='[&_.ProseMirror]:min-h-[180px]'
                undoRedo={false}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

/**
 * A caution when the lead's person isn't at the chosen company: saving the
 * lead adds them to it (portal access stays off). Never blocks saving.
 */
function ContactCompanyMismatchNote({
  control,
}: {
  control: Control<LeadFormValues>
}) {
  const contact = useWatch({ control, name: 'contact' })
  const company = useWatch({ control, name: 'company' })
  const { data: options = [] } = useContactOptions()

  const companyIds = contact
    ? options.find(option => option.id === contact.id)?.companyIds
    : undefined
  // Only once the person's companies are known, and only for a mismatch.
  if (!contact || !company || !companyIds || companyIds.includes(company.id)) {
    return null
  }

  const contactName = contact.name || 'This person'
  const companyName = company.name || 'this company'
  return (
    <SaveSideEffect>
      {contactName} isn&rsquo;t at {companyName} yet, and will be added to{' '}
      {companyName} when you save.
    </SaveSideEffect>
  )
}
