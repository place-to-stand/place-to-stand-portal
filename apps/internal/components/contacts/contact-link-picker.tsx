'use client'

import type { ReactElement } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UserRound } from 'lucide-react'

import { fetchContactOptions } from '@/app/(dashboard)/people/actions'
import {
  EntityLinkPicker,
  type EntityLinkOption,
} from '@/components/ui/entity-link-picker'
import type { ContactOption } from '@/lib/queries/contacts/options'

export const CONTACT_OPTIONS_QUERY_KEY = ['contactOptions'] as const

/** Every live contact, for the contact pickers. */
export function useContactOptions() {
  return useQuery<ContactOption[]>({
    queryKey: CONTACT_OPTIONS_QUERY_KEY,
    queryFn: () => fetchContactOptions(),
    staleTime: 0,
  })
}

export type ContactLink = {
  id: string
  name: string
  email: string | null
  phone: string | null
  /** Where they work now, when known (null for a just-created contact). */
  companyId?: string | null
  companyName?: string | null
}

type ContactLinkPickerProps = {
  value: ContactLink | null
  onChange: (value: ContactLink | null) => void
  disabled?: boolean
  id?: string
  /** Contacts not to offer (e.g. people already on the list). */
  excludeIds?: readonly string[]
  /** A button in place of the field; see `EntityLinkPicker`. */
  trigger?: ReactElement
  /** A "Create" button beside the field; see `EntityLinkPicker`. */
  showCreateButton?: boolean
  /** Company to prefill on a contact created from here. */
  createCompanyId?: string | null
  /** Controlled open state; see `EntityLinkPicker`. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** "Email · Company", the second line under a contact's name. */
function describe(contact: {
  email: string | null
  companyName?: string | null
}) {
  return (
    [contact.email, contact.companyName].filter(Boolean).join(' · ') || null
  )
}

/** Link a record to a contact: search, create (stacked sheet), clear, open. */
export function ContactLinkPicker({
  value,
  onChange,
  disabled,
  id,
  excludeIds,
  trigger,
  showCreateButton,
  createCompanyId,
  open,
  onOpenChange,
}: ContactLinkPickerProps) {
  const { data = [] } = useContactOptions()

  const byId = new Map(data.map(contact => [contact.id, contact]))
  const excluded = new Set(excludeIds)
  const options: EntityLinkOption[] = data
    .filter(contact => !excluded.has(contact.id))
    .map(contact => ({
      id: contact.id,
      label: contact.name,
      description: describe(contact),
    }))

  return (
    <EntityLinkPicker
      id={id}
      entity='contact'
      entityLabel='person'
      aria-label='Person'
      icon={UserRound}
      value={
        value
          ? { id: value.id, label: value.name, description: describe(value) }
          : null
      }
      onChange={option => {
        if (!option) return onChange(null)
        const known = byId.get(option.id)
        onChange({
          id: option.id,
          name: known?.name ?? option.label,
          email: known?.email ?? value?.email ?? null,
          phone: known?.phone ?? value?.phone ?? null,
          companyId: known?.companyId ?? null,
          companyName: known?.companyName ?? null,
        })
      }}
      options={options}
      disabled={disabled}
      toOption={record => ({
        id: record.id,
        label: record.name,
        description: record.email,
      })}
      createPrefillParam='contactName'
      createParams={
        createCompanyId ? { contactCompanyId: createCompanyId } : undefined
      }
      showCreateButton={showCreateButton}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}
