'use client'

import { useQuery } from '@tanstack/react-query'
import { Contact } from 'lucide-react'

import { fetchContactOptions } from '@/app/(dashboard)/contacts/actions'
import {
  EntityLinkPicker,
  type EntityLinkOption,
} from '@/components/ui/entity-link-picker'
import type { ContactOption } from '@/lib/queries/contacts/options'

export const CONTACT_OPTIONS_QUERY_KEY = ['contactOptions'] as const

export type ContactLink = {
  id: string
  name: string
  email: string | null
  phone: string | null
}

type ContactLinkPickerProps = {
  value: ContactLink | null
  onChange: (value: ContactLink | null) => void
  disabled?: boolean
  id?: string
}

/** "Email · Company", the second line under a contact's name. */
function describe(contact: { email: string | null; companyName?: string | null }) {
  return [contact.email, contact.companyName].filter(Boolean).join(' · ') || null
}

/** Link a record to a contact: search, create (stacked sheet), clear, open. */
export function ContactLinkPicker({
  value,
  onChange,
  disabled,
  id,
}: ContactLinkPickerProps) {
  const { data = [] } = useQuery<ContactOption[]>({
    queryKey: CONTACT_OPTIONS_QUERY_KEY,
    queryFn: () => fetchContactOptions(),
    staleTime: 0,
  })

  const byId = new Map(data.map(contact => [contact.id, contact]))
  const options: EntityLinkOption[] = data.map(contact => ({
    id: contact.id,
    label: contact.name,
    description: describe(contact),
  }))

  return (
    <EntityLinkPicker
      id={id}
      entity='contact'
      entityLabel='contact'
      aria-label='Contact'
      icon={Contact}
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
    />
  )
}
