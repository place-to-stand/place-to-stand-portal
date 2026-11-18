import type { z } from 'zod'

import { businessSettingsSchema } from '@/lib/business/settings-form'

/** The Business page fields react-hook-form holds (images live apart). */
export const textSchema = businessSettingsSchema.omit({
  logo: true,
  icon: true,
})
export type TextInput = z.input<typeof textSchema>
export type TextOutput = z.output<typeof textSchema>
export type TextField = Exclude<keyof TextInput, 'profitSharePartnerIds'>

export type Field = {
  name: TextField
  label: string
  optional?: boolean
  type?: 'email' | 'url' | 'tel'
  autoComplete?: string
  wide?: boolean
}

export const SECTIONS: { title: string; fields: Field[] }[] = [
  {
    title: 'Business',
    fields: [
      { name: 'name', label: 'Name', autoComplete: 'organization' },
      { name: 'legalName', label: 'Legal name', optional: true },
      {
        name: 'website',
        label: 'Website',
        optional: true,
        type: 'url',
        wide: true,
      },
    ],
  },
  {
    title: 'Address',
    fields: [
      {
        name: 'addressLine1',
        label: 'Street',
        optional: true,
        wide: true,
        autoComplete: 'address-line1',
      },
      {
        name: 'addressLine2',
        label: 'Street line 2',
        optional: true,
        wide: true,
        autoComplete: 'address-line2',
      },
      {
        name: 'city',
        label: 'City',
        optional: true,
        autoComplete: 'address-level2',
      },
      {
        name: 'region',
        label: 'State',
        optional: true,
        autoComplete: 'address-level1',
      },
      {
        name: 'postalCode',
        label: 'Postal code',
        optional: true,
        autoComplete: 'postal-code',
      },
      {
        name: 'country',
        label: 'Country',
        optional: true,
        autoComplete: 'country',
      },
    ],
  },
  {
    title: 'Phone and email',
    fields: [
      { name: 'phone', label: 'Phone', optional: true, type: 'tel' },
      {
        name: 'inboxEmail',
        label: 'Inbox email',
        optional: true,
        type: 'email',
      },
      {
        name: 'sendingEmail',
        label: 'Sending email',
        optional: true,
        type: 'email',
      },
      {
        name: 'bookingUrl',
        label: 'Booking link',
        optional: true,
        type: 'url',
      },
    ],
  },
]
