'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@pts/ui/button'
import { Checkbox } from '@pts/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@pts/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { Switch } from '@pts/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import { DesignSection, Specimen } from './specimen'

const COMBOBOX_ITEMS: SearchableComboboxItem[] = [
  { value: 'acme', label: 'Acme Corp', description: 'Net 30' },
  { value: 'globex', label: 'Globex', description: 'Prepaid' },
  { value: 'initech', label: 'Initech', description: 'Net 30' },
  { value: 'umbrella', label: 'Umbrella Co', description: 'Prepaid' },
]

const demoFormSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

function DemoValidationForm() {
  const form = useForm<z.infer<typeof demoFormSchema>>({
    resolver: zodResolver(demoFormSchema),
    defaultValues: { email: 'not-an-email' },
  })

  // Surface the validation error immediately so the specimen shows the
  // error styling without requiring interaction.
  useEffect(() => {
    void form.trigger('email')
  }, [form])

  return (
    <Form {...form}>
      <form
        className='w-full max-w-sm space-y-4'
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
                <Input type='email' placeholder='you@example.com' {...field} />
              </FormControl>
              <FormDescription>
                react-hook-form + zod via components/ui/form.tsx
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit' size='sm'>
          Submit
        </Button>
      </form>
    </Form>
  )
}

export function PrimitivesForms() {
  const [phone, setPhone] = useState('5551234567')
  const [combobox, setCombobox] = useState<string | null>('acme')

  return (
    <DesignSection
      id='forms'
      title='Form controls'
      description='Inputs, selection controls, and the react-hook-form + zod field pattern.'
    >
      <Specimen label='Input' className='max-w-xl flex-col items-stretch'>
        <Input placeholder='Placeholder text' />
        <Input defaultValue='Filled value' />
        <Input placeholder='Disabled' disabled />
        <Input aria-invalid placeholder='Invalid (aria-invalid)' />
      </Specimen>

      <Specimen label='Textarea' className='max-w-xl flex-col items-stretch'>
        <Textarea placeholder='Write a longer note…' rows={3} />
        <Textarea placeholder='Disabled' disabled rows={2} />
      </Specimen>

      <Specimen label='PhoneInput' className='max-w-xl flex-col items-stretch'>
        <PhoneInput value={phone} onChange={setPhone} />
        <p className='text-muted-foreground text-xs'>
          Stores raw digits: <span className='font-mono'>{phone}</span>
        </p>
      </Specimen>

      <Specimen label='Label + Checkbox'>
        <div className='flex items-center gap-2'>
          <Checkbox id='design-check-1' defaultChecked />
          <Label htmlFor='design-check-1'>Checked</Label>
        </div>
        <div className='flex items-center gap-2'>
          <Checkbox id='design-check-2' />
          <Label htmlFor='design-check-2'>Unchecked</Label>
        </div>
        <div className='flex items-center gap-2'>
          <Checkbox id='design-check-3' disabled />
          <Label htmlFor='design-check-3'>Disabled</Label>
        </div>
      </Specimen>

      <Specimen label='Switch' note='sizes: default, sm'>
        <div className='flex items-center gap-2'>
          <Switch id='design-switch-1' defaultChecked />
          <Label htmlFor='design-switch-1'>default</Label>
        </div>
        <div className='flex items-center gap-2'>
          <Switch id='design-switch-2' size='sm' defaultChecked />
          <Label htmlFor='design-switch-2'>sm</Label>
        </div>
        <div className='flex items-center gap-2'>
          <Switch id='design-switch-3' disabled />
          <Label htmlFor='design-switch-3'>disabled</Label>
        </div>
      </Specimen>

      <Specimen label='Select' note='trigger sizes: default, sm'>
        <div className='w-48'>
          <Select defaultValue='active'>
            <SelectTrigger>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='onboarding'>Onboarding</SelectItem>
              <SelectItem value='active'>Active</SelectItem>
              <SelectItem value='on-hold'>On hold</SelectItem>
              <SelectItem value='completed'>Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className='w-48'>
          <Select>
            <SelectTrigger size='sm'>
              <SelectValue placeholder='Small trigger' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='one'>Option one</SelectItem>
              <SelectItem value='two'>Option two</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Specimen>

      <Specimen
        label='SearchableCombobox'
        className='max-w-sm flex-col items-stretch'
      >
        <SearchableCombobox
          items={COMBOBOX_ITEMS}
          value={combobox}
          onChange={setCombobox}
          placeholder='Select a client'
          searchPlaceholder='Search clients…'
          ariaLabel='Sample client combobox'
        />
      </Specimen>

      <Specimen
        label='Form field pattern'
        note='visible validation error'
        className='items-start'
      >
        <DemoValidationForm />
      </Specimen>
    </DesignSection>
  )
}
