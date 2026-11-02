'use client'

import type { Control } from 'react-hook-form'

import { Input } from '@pts/ui/input'
import { SheetSection } from '@/components/sheets/sheet-section'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { UrlInput } from '@/components/ui/url-input'

import type { CompanyFormValues } from './use-company-sheet-form'

/** The Company column's details fields: name, website, LinkedIn and notes. */
export function CompanyDetailsFields({
  control,
  disabled,
}: {
  control: Control<CompanyFormValues>
  disabled: boolean
}) {
  return (
    <SheetSection>
      <FormField
        control={control}
        name='name'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder='Acme Inc.'
                disabled={disabled}
                data-autofocus
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name='website'
        render={({ field }) => (
          <FormItem>
            <FormLabel optional>Website</FormLabel>
            <FormControl>
              <UrlInput
                {...field}
                openLabel='Open website'
                placeholder='acme.com'
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name='linkedinUrl'
        render={({ field }) => (
          <FormItem>
            <FormLabel optional>LinkedIn</FormLabel>
            <FormControl>
              <UrlInput
                {...field}
                openLabel='Open LinkedIn'
                placeholder='linkedin.com/company/acme'
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name='notes'
        render={({ field }) => (
          <FormItem>
            <FormLabel optional>Notes</FormLabel>
            <FormControl>
              <RichTextEditor
                id='company-notes'
                value={field.value ?? ''}
                onChange={field.onChange}
                disabled={disabled}
                contentMinHeightClassName='[&_.ProseMirror]:min-h-[140px]'
                undoRedo={false}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </SheetSection>
  )
}
