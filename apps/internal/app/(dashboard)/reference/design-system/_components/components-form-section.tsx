'use client'

import { useForm } from 'react-hook-form'
import { Plus } from 'lucide-react'

import { Button } from '@placetostand/ui/button'
import { Input } from '@placetostand/ui/input'
import { Label } from '@placetostand/ui/label'

import {
  FORM_FIELD_WIDE_CLASS,
  FORM_SECTIONS_CLASS,
  FormSection,
} from '@/components/forms/form-section'
import { PageForm } from '@/components/layout/page-form'
import { PagePanel } from '@/components/layout/page-panel'

import { DesignSection, Specimen } from './specimen'

export function ComponentsFormSections() {
  return (
    <DesignSection
      id='form-sections'
      title='Form sections and page forms'
      when='A full-page form (Settings pages): each titled group of fields, or a list with its own Create button, inside a PageForm that brings the save bar. In a sheet use SheetSection and the sheet footer.'
    >
      <Specimen
        label='FormSection'
        note='components/forms/form-section.tsx: title, optional description and action; fields sit in a two-column grid (FORM_FIELD_WIDE_CLASS spans both); layout="block" for a table or list. Sections stack in FORM_SECTIONS_CLASS, 32px apart.'
        className='block'
      >
        <div className={`${FORM_SECTIONS_CLASS} max-w-3xl`}>
          <FormSection title='Address'>
            <div className={`grid gap-2 ${FORM_FIELD_WIDE_CLASS}`}>
              <Label htmlFor='design-street'>Street</Label>
              <Input id='design-street' placeholder='123 Main St' />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='design-city'>City</Label>
              <Input id='design-city' placeholder='Austin' />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='design-state'>State</Label>
              <Input id='design-state' placeholder='TX' />
            </div>
          </FormSection>
          <FormSection
            title='Tax rates'
            description='Applied to invoice lines by the client’s state.'
            layout='block'
            action={
              <Button size='sm'>
                <Plus />
                Create tax rate
              </Button>
            }
          >
            <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-sm'>
              A table or list goes here.
            </div>
          </FormSection>
        </div>
      </Specimen>
      <Specimen
        label='PageForm'
        note='components/layout/page-form.tsx: type in the field and the save bar (the sheet footer, FormFooterBar) slides up across the bottom of the page: undo and redo, Discard, Save (⌘S). Saving here only waits; Save reads “Saved” for 2s, then the bar slides away.'
        className='block'
      >
        <PagePanel className='max-w-3xl'>
          <PageFormDemo />
        </PagePanel>
      </Specimen>
    </DesignSection>
  )
}

function PageFormDemo() {
  const form = useForm<{ name: string }>({
    defaultValues: { name: 'Test Agency' },
  })
  return (
    <PageForm
      form={form}
      historyKey='design-page-form'
      onSave={async values => {
        await new Promise(resolve => setTimeout(resolve, 600))
        form.reset(values)
        return true
      }}
    >
      <FormSection title='Business'>
        <div className='grid gap-2'>
          <Label htmlFor='design-page-form-name'>Name</Label>
          <Input id='design-page-form-name' {...form.register('name')} />
        </div>
      </FormSection>
    </PageForm>
  )
}
