'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Checkbox } from '@pts/ui/checkbox'
import { Input } from '@pts/ui/input'
import { Label } from '@pts/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { Switch } from '@pts/ui/switch'
import { Textarea } from '@pts/ui/textarea'
import {
  CompanyLinkPicker,
  type CompanyLink,
} from '@/components/companies/company-link-picker'
import {
  ContactLinkPicker,
  type ContactLink,
} from '@/components/contacts/contact-link-picker'
import { EntityLinkPicker } from '@/components/ui/entity-link-picker'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PhoneInput } from '@/components/ui/phone-input'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import { UrlInput } from '@/components/ui/url-input'

import { DesignSection, Example, Specimen } from './specimen'
import { ENTITY_ICONS } from '@/lib/entity-accents'

const STATIC_COMPANIES = [
  { id: 'design-acme', label: 'Acme Industries', description: 'Client' },
  { id: 'design-birch', label: 'Birchwood Labs', description: null },
  { id: 'design-cobalt', label: 'Cobalt & Co', description: 'Client' },
]

// Long enough to scroll, with the selection near the end: the picker opens
// with the selected person in view and highlighted.
const COMBOBOX_ITEMS: SearchableComboboxItem[] = [
  'Ada Lovelace',
  'Alan Turing',
  'Annie Easley',
  'Barbara Liskov',
  'Charles Babbage',
  'Dorothy Vaughan',
  'Edsger Dijkstra',
  'Frances Allen',
  'Grace Hopper',
  'Hedy Lamarr',
  'Ida Rhodes',
  'Jean Sammet',
  'Katherine Johnson',
  'Margaret Hamilton',
  'Radia Perlman',
  'Shafi Goldwasser',
  'Tim Berners-Lee',
].map(name => ({
  value: name.split(' ')[0]!.toLowerCase(),
  label: name,
  description: `${name.split(' ')[0]!.toLowerCase()}@example.com`,
}))

const emailSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  title: z.string().optional(),
})

function ValidationForm() {
  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: 'not-an-email', title: '' },
  })

  // Show the error state without waiting for a submit.
  useEffect(() => {
    void form.trigger('email')
  }, [form])

  return (
    <Form {...form}>
      <form
        className='grid w-full grid-cols-1 gap-4 md:grid-cols-2'
        onSubmit={form.handleSubmit(() => undefined)}
        noValidate
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type='email' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='title'
          render={({ field }) => (
            <FormItem>
              <FormLabel optional>Job title</FormLabel>
              <FormControl>
                <Input placeholder='Head of product' {...field} />
              </FormControl>
              <FormDescription>
                Shown under the person&apos;s name.
              </FormDescription>
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}

export function ComponentsInputs() {
  const [phone, setPhone] = useState('5551234567')
  const [url, setUrl] = useState('https://placetostandagency.com')

  return (
    <DesignSection
      id='inputs'
      title='Inputs'
      when='Free text. Label every field, mark optional ones with FormLabel optional, and add helper copy only when it changes a decision. Inputs use 16px below md so iOS does not zoom.'
    >
      <Specimen
        label='Input states'
        className='grid grid-cols-1 gap-6 md:grid-cols-2'
      >
        <Example caption='placeholder' className='[&>div]:w-full'>
          <Input placeholder='Company name' />
        </Example>
        <Example caption='filled' className='[&>div]:w-full'>
          <Input defaultValue='Acme Industries' />
        </Example>
        <Example caption='disabled' className='[&>div]:w-full'>
          <Input defaultValue='Locked after sending' disabled />
        </Example>
        <Example caption='aria-invalid' className='[&>div]:w-full'>
          <Input aria-invalid defaultValue='acme@' />
        </Example>
      </Specimen>

      <Specimen
        label='Specialised inputs'
        className='grid grid-cols-1 gap-6 md:grid-cols-2'
      >
        <Example caption='Textarea' className='[&>div]:w-full'>
          <Textarea placeholder='Notes about this company…' rows={3} />
        </Example>
        <Example
          caption={`PhoneInput · stores digits: ${phone}`}
          className='[&>div]:w-full'
        >
          <PhoneInput value={phone} onChange={setPhone} />
        </Example>
        <Example
          caption='UrlInput · open button appears for a valid link'
          className='[&>div]:w-full'
        >
          <UrlInput
            value={url}
            onChange={event => setUrl(event.target.value)}
            openLabel='Open website'
            aria-label='Website'
          />
        </Example>
      </Specimen>

      <Specimen
        label='Form field pattern'
        note='react-hook-form + zod through components/ui/form'
      >
        <ValidationForm />
      </Specimen>
    </DesignSection>
  )
}

export function ComponentsPickers() {
  const [status, setStatus] = useState('active')
  const [person, setPerson] = useState<string | null>('radia')
  const [company, setCompany] = useState<CompanyLink | null>(null)
  const [contact, setContact] = useState<ContactLink | null>(null)
  const [staticCompany, setStaticCompany] = useState<{
    id: string
    label: string
  } | null>({ id: 'design-acme', label: 'Acme Industries' })

  return (
    <DesignSection
      id='pickers'
      title='Select and pickers'
      when='Select for a short fixed list. SearchableCombobox once the list needs search. Link one record to another with its entity picker: search, a pinned Create row, clear, and open, saved with the host form.'
    >
      <Specimen
        label='Select and combobox'
        className='grid grid-cols-1 gap-6 md:grid-cols-3'
      >
        <Example caption='Select' className='[&>div]:w-full'>
          <Select
            value={status}
            onValueChange={value => setStatus(value ?? '')}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='onboarding'>Onboarding</SelectItem>
              <SelectItem value='active'>Active</SelectItem>
              <SelectItem value='on-hold'>On hold</SelectItem>
              <SelectItem value='completed'>Completed</SelectItem>
            </SelectContent>
          </Select>
        </Example>
        <Example
          caption="Select size='sm' (dense rows)"
          className='[&>div]:w-full'
        >
          <Select defaultValue='net-30'>
            <SelectTrigger size='sm' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='prepaid'>Prepaid</SelectItem>
              <SelectItem value='net-30'>Net 30</SelectItem>
            </SelectContent>
          </Select>
        </Example>
        <Example caption='SearchableCombobox' className='[&>div]:w-full'>
          <SearchableCombobox
            items={COMBOBOX_ITEMS}
            value={person}
            onChange={setPerson}
            placeholder='Select a person'
            searchPlaceholder='Search people…'
            ariaLabel='Person'
            onClear={() => setPerson(null)}
            clearLabel='person'
          />
        </Example>
      </Specimen>

      <Specimen
        label='Entity link pickers'
        note='Live data. Create opens the real create sheet; the link saves with the host form'
        className='grid grid-cols-1 gap-6 md:grid-cols-3'
      >
        <Example caption='CompanyLinkPicker' className='[&>div]:w-full'>
          <CompanyLinkPicker value={company} onChange={setCompany} />
        </Example>
        <Example
          caption='ContactLinkPicker (a person)'
          className='[&>div]:w-full'
        >
          <ContactLinkPicker value={contact} onChange={setContact} />
        </Example>
        <Example
          caption='EntityLinkPicker, static options, no Create'
          className='[&>div]:w-full'
        >
          <EntityLinkPicker
            entity='company'
            entityLabel='company'
            aria-label='Company'
            icon={ENTITY_ICONS.company}
            value={staticCompany}
            onChange={setStaticCompany}
            options={STATIC_COMPANIES}
            toOption={record => ({ id: record.id, label: record.name })}
            createPrefillParam='companyName'
            allowCreate={false}
          />
        </Example>
      </Specimen>
    </DesignSection>
  )
}

export function ComponentsToggles() {
  return (
    <DesignSection
      id='toggles'
      title='Switch and checkbox'
      when='A switch turns a setting on or off; a checkbox picks items or agrees to something. In a sheet both apply on Save. The checked switch is emerald, set inside the component; never override it.'
    >
      <Specimen
        label='Switch'
        className='grid grid-cols-1 gap-4 sm:grid-cols-3'
      >
        <div className='flex items-center gap-2'>
          <Switch id='design-switch-on' defaultChecked />
          <Label htmlFor='design-switch-on'>Portal access</Label>
        </div>
        <div className='flex items-center gap-2'>
          <Switch id='design-switch-sm' size='sm' />
          <Label htmlFor='design-switch-sm'>Small, off</Label>
        </div>
        <div className='flex items-center gap-2'>
          <Switch id='design-switch-disabled' disabled defaultChecked />
          <Label htmlFor='design-switch-disabled'>Disabled</Label>
        </div>
      </Specimen>
      <Specimen
        label='Checkbox'
        className='grid grid-cols-1 gap-4 sm:grid-cols-3'
      >
        <div className='flex items-center gap-2'>
          <Checkbox id='design-check-on' defaultChecked />
          <Label htmlFor='design-check-on'>Primary contact</Label>
        </div>
        <div className='flex items-center gap-2'>
          <Checkbox id='design-check-off' />
          <Label htmlFor='design-check-off'>Unchecked</Label>
        </div>
        <div className='flex items-center gap-2'>
          <Checkbox id='design-check-disabled' disabled />
          <Label htmlFor='design-check-disabled'>Disabled</Label>
        </div>
      </Specimen>
    </DesignSection>
  )
}
