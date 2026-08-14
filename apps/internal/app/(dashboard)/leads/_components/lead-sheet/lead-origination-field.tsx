'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { FormItem, FormLabel } from '@/components/ui/form'
import { loadOriginationOptions } from '@/components/origination/actions'
import { OriginationPicker } from '@/components/origination/origination-picker'
import type {
  OriginationContactOption,
  OriginationMode,
  PartnerUserOption,
} from '@/components/origination/types'

import type { LeadFormValues } from './types'

type LeadOriginationFieldProps = {
  disabled: boolean
}

/**
 * Origination for a lead, rendered with the SHARED picker (C9).
 *
 * Options are self-fetched rather than threaded through sheet-init (C12): the
 * lead sheet has no contacts on any path, and widening `SheetInitPayloads` would
 * add a full contacts list to a route serving every dashboard sheet. The loader
 * emits the picker's own option shapes, so nothing is mapped here (C13).
 */
export function LeadOriginationField({ disabled }: LeadOriginationFieldProps) {
  const form = useFormContext<LeadFormValues>()
  const [options, setOptions] = useState<{
    contacts: OriginationContactOption[]
    users: PartnerUserOption[]
  }>({ contacts: [], users: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false)
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false)

  const mode = useWatch({ control: form.control, name: 'originationMode' })
  const contactId = useWatch({
    control: form.control,
    name: 'originationContactId',
  })
  const userId = useWatch({ control: form.control, name: 'originationUserId' })

  useEffect(() => {
    let cancelled = false

    loadOriginationOptions()
      .then(result => {
        if (!cancelled) {
          setOptions(result)
        }
      })
      .catch(error => {
        console.error('Failed to load origination options:', error)
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const selectedContact = useMemo(
    () => options.contacts.find(contact => contact.id === contactId) ?? null,
    [contactId, options.contacts]
  )
  const selectedUser = useMemo(
    () => options.users.find(user => user.id === userId) ?? null,
    [options.users, userId]
  )

  // Default to 'internal' unless an external referrer is already set — same
  // default the client sheet applies, so the two read identically.
  const resolvedMode: OriginationMode = mode ?? (contactId ? 'external' : 'internal')

  return (
    <FormItem>
      <FormLabel>Origination</FormLabel>
      <OriginationPicker
        mode={resolvedMode}
        selectedUser={selectedUser}
        selectedContact={selectedContact}
        availableUsers={options.users}
        availableContacts={options.contacts}
        disabled={disabled}
        disabledReason={
          disabled ? 'Admin access is required to edit leads.' : null
        }
        isUserPickerOpen={isUserPickerOpen}
        isContactPickerOpen={isContactPickerOpen}
        isPending={isLoading}
        pendingReason='Loading people…'
        onModeChange={nextMode => {
          // The mutex is enforced here as well as in the database, so switching
          // modes can never surface a constraint violation to the user.
          form.setValue('originationMode', nextMode, { shouldDirty: true })
        }}
        onUserPickerOpenChange={setIsUserPickerOpen}
        onContactPickerOpenChange={setIsContactPickerOpen}
        onSelectUser={user => {
          form.setValue('originationUserId', user.id, { shouldDirty: true })
          form.setValue('originationContactId', null, { shouldDirty: true })
          setIsUserPickerOpen(false)
        }}
        onSelectContact={contact => {
          form.setValue('originationContactId', contact.id, {
            shouldDirty: true,
          })
          form.setValue('originationUserId', null, { shouldDirty: true })
          setIsContactPickerOpen(false)
        }}
        onClear={() => {
          form.setValue('originationContactId', null, { shouldDirty: true })
          form.setValue('originationUserId', null, { shouldDirty: true })
        }}
      />
    </FormItem>
  )
}
