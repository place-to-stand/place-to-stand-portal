'use client'

import * as React from 'react'
import { Plus } from 'lucide-react'

import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'

export type ContactSelectorContact = {
  id: string
  email: string
  name: string
  phone?: string | null
}

type ContactSelectorProps = {
  contacts: ContactSelectorContact[]
  value?: string | null
  onChange: (contactId: string | null) => void
  onCreateNew: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Exclude these contact IDs from the list (already added) */
  excludeIds?: string[]
}

const CREATE_NEW_VALUE = '__create_new__'

export function ContactSelector({
  contacts,
  value,
  onChange,
  onCreateNew,
  placeholder = 'Search or add contact...',
  disabled,
  className,
  excludeIds = [],
}: ContactSelectorProps) {
  const filteredContacts = React.useMemo(
    () => contacts.filter(c => !excludeIds.includes(c.id)),
    [contacts, excludeIds]
  )

  const items: SearchableComboboxItem[] = React.useMemo(
    () => [
      {
        value: CREATE_NEW_VALUE,
        label: 'Create new contact',
        icon: Plus,
        keywords: ['add', 'new', 'create'],
      },
      ...filteredContacts.map(contact => ({
        value: contact.id,
        label: contact.name,
        description: contact.email,
        keywords: [contact.email, contact.phone ?? ''].filter(Boolean),
      })),
    ],
    [filteredContacts]
  )

  const handleChange = React.useCallback(
    (selectedValue: string) => {
      if (selectedValue === CREATE_NEW_VALUE) {
        onCreateNew()
        return
      }
      onChange(selectedValue || null)
    },
    [onChange, onCreateNew]
  )

  return (
    <SearchableCombobox
      items={items}
      value={value ?? ''}
      onChange={handleChange}
      placeholder={placeholder}
      searchPlaceholder='Search contacts...'
      emptyMessage='No contacts found'
      disabled={disabled}
      className={className}
    />
  )
}
