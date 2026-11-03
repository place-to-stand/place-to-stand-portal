'use client'

import type { Control } from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { LazyRichTextEditor as RichTextEditor } from '@/components/ui/rich-text-editor/lazy'
import type { ContactFormData } from '@/lib/people/use-contact-sheet-state'

/** The person's notes: rich text, saved with the sheet (as on companies). */
export function ContactNotesField({
  control,
  disabled,
}: {
  control: Control<ContactFormData>
  disabled: boolean
}) {
  return (
    <FormField
      control={control}
      name='notes'
      render={({ field }) => (
        <FormItem>
          <FormLabel optional>Notes</FormLabel>
          <FormControl>
            <RichTextEditor
              id='contact-notes'
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
  )
}
