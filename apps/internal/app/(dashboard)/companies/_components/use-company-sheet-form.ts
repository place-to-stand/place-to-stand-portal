'use client'

import { useCallback, useEffect } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import {
  CONTACT_OPTIONS_QUERY_KEY,
  useContactOptions,
  type ContactLink,
} from '@/components/contacts/contact-link-picker'
import type { CompanyDetail } from '@/lib/companies/types'
import { subscribeSheetCreated } from '@/lib/sheets/created'

export const companyFormSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(160),
  website: z.string().trim().max(255),
  linkedinUrl: z.string().trim().max(255),
  notes: z.string().max(20000),
  /** Set with the star on the People list; saved in the same transaction. */
  primaryContactId: z.string().nullable(),
  /** People picked on the People list; they join (or move here) on Save. */
  addedContacts: z.array(
    z.object({ id: z.string(), name: z.string(), email: z.string().nullable() })
  ),
  /** People taken off the People list; they leave the company on Save. */
  removedContactIds: z.array(z.string()),
  /** Each contact's title here, by contact id; saved with the sheet. */
  titles: z.record(z.string(), z.string().max(160)),
})

export type CompanyFormValues = z.infer<typeof companyFormSchema>

export const companySheetQueryKey = (companyId: string | null) =>
  ['companySheet', companyId] as const

/**
 * The company sheet's staged edits: People (add, remove, titles, primary
 * star). Everything here only sets form values;
 * the sheet saves them together on Save.
 */
export function useCompanySheetForm({
  form,
  company,
  companyId,
}: {
  form: UseFormReturn<CompanyFormValues>
  company: CompanyDetail | null
  companyId: string | null
}) {
  const queryClient = useQueryClient()

  // The star on the People list is the one control for this field; it saves
  // with the form.
  const titles = useWatch({ control: form.control, name: 'titles' }) ?? {}
  const handleTitleChange = useCallback(
    (contactId: string, title: string) =>
      form.setValue(`titles.${contactId}`, title, { shouldDirty: true }),
    [form]
  )
  const primaryContactId = useWatch({
    control: form.control,
    name: 'primaryContactId',
  })
  const handleSetPrimary = useCallback(
    (contactId: string | null) =>
      form.setValue('primaryContactId', contactId, { shouldDirty: true }),
    [form]
  )

  const addedContacts = useWatch({
    control: form.control,
    name: 'addedContacts',
  })
  const removedContactIds = useWatch({
    control: form.control,
    name: 'removedContactIds',
  })
  const { data: contactOptions = [] } = useContactOptions()

  const handleAddPerson = useCallback(
    (contact: ContactLink) => {
      const removed = form.getValues('removedContactIds')
      if (removed.includes(contact.id)) {
        form.setValue(
          'removedContactIds',
          removed.filter(id => id !== contact.id),
          { shouldDirty: true }
        )
        return
      }
      const added = form.getValues('addedContacts')
      if (
        added.some(person => person.id === contact.id) ||
        company?.contacts.some(person => person.id === contact.id)
      ) {
        return
      }
      form.setValue(
        'addedContacts',
        [
          ...added,
          { id: contact.id, name: contact.name, email: contact.email },
        ],
        { shouldDirty: true }
      )
      // A contact just created on the stacked sheet isn't in the list yet.
      if (!contactOptions.some(option => option.id === contact.id)) {
        void queryClient.invalidateQueries({
          queryKey: CONTACT_OPTIONS_QUERY_KEY,
        })
      }
    },
    [company?.contacts, contactOptions, form, queryClient]
  )

  const handleRemovePerson = useCallback(
    (contactId: string) => {
      const added = form.getValues('addedContacts')
      if (added.some(person => person.id === contactId)) {
        form.setValue(
          'addedContacts',
          added.filter(person => person.id !== contactId),
          { shouldDirty: true }
        )
      } else {
        form.setValue(
          'removedContactIds',
          [...form.getValues('removedContactIds'), contactId],
          { shouldDirty: true }
        )
      }
      // Leaving the company gives up being its primary contact.
      if (form.getValues('primaryContactId') === contactId) {
        form.setValue('primaryContactId', null, { shouldDirty: true })
      }
    },
    [form]
  )

  const handleUndoRemovePerson = useCallback(
    (contactId: string) =>
      form.setValue(
        'removedContactIds',
        form.getValues('removedContactIds').filter(id => id !== contactId),
        { shouldDirty: true }
      ),
    [form]
  )

  const movesFrom = useCallback(
    (contactId: string) => {
      const option = contactOptions.find(contact => contact.id === contactId)
      return option?.companyId && option.companyId !== companyId
        ? (option.companyName ?? 'another company')
        : null
    },
    [companyId, contactOptions]
  )

  // Billing switched on saves this company as a client: refresh so Billing shows.
  useEffect(
    () =>
      subscribeSheetCreated('client', () => {
        void queryClient.invalidateQueries({
          queryKey: companySheetQueryKey(companyId),
        })
      }),
    [companyId, queryClient]
  )
  return {
    titles,
    primaryContactId,
    addedContacts,
    removedContactIds,
    movesFrom,
    handleTitleChange,
    handleSetPrimary,
    handleAddPerson,
    handleRemovePerson,
    handleUndoRemovePerson,
  }
}
