'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type React from 'react'
import { Archive, Redo2, Undo2 } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'

import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'

const FEEDBACK_CLASSES =
  'border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'

type ContactFormValues = {
  email: string
  name: string
  phone?: string
}

type ContactSheetFormProps = {
  form: UseFormReturn<ContactFormValues>
  feedback: string | null
  isPending: boolean
  isEditing: boolean
  pendingReason: string
  submitDisabled: boolean
  submitDisabledReason: string | null
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  onSubmit: (data: ContactFormValues) => void
  onRequestDelete: () => void
  isSheetOpen: boolean
  historyKey: string
}

export function ContactSheetForm({
  form,
  feedback,
  isPending,
  isEditing,
  pendingReason,
  submitDisabled,
  submitDisabledReason,
  deleteDisabled,
  deleteDisabledReason,
  onSubmit,
  onRequestDelete,
  isSheetOpen,
  historyKey,
}: ContactSheetFormProps) {
  const handleSave = useCallback(
    () => form.handleSubmit(onSubmit)(),
    [form, onSubmit]
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls({
    form,
    isActive: isSheetOpen,
    canSave: !submitDisabled,
    onSave: handleSave,
    historyKey,
  })

  const saveLabel = useMemo(() => {
    if (isPending) {
      return 'Saving...'
    }

    return isEditing ? 'Save changes' : 'Create contact'
  }, [isEditing, isPending])

  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSheetOpen && firstFieldRef.current) {
      // Small delay to ensure sheet animation completes
      const timeoutId = setTimeout(() => {
        firstFieldRef.current?.focus()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [isSheetOpen])

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='flex flex-1 flex-col gap-5 px-6 pb-32'
      >
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <DisabledFieldTooltip
                  disabled={isPending}
                  reason={isPending ? pendingReason : null}
                >
                  <Input
                    {...field}
                    ref={node => {
                      firstFieldRef.current = node
                      if (typeof field.ref === 'function') {
                        field.ref(node)
                      } else if (field.ref) {
                        ;(
                          field.ref as React.MutableRefObject<HTMLInputElement | null>
                        ).current = node
                      }
                    }}
                    value={field.value ?? ''}
                    placeholder='John Doe'
                    disabled={isPending}
                  />
                </DisabledFieldTooltip>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <DisabledFieldTooltip
                  disabled={isPending}
                  reason={isPending ? pendingReason : null}
                >
                  <Input
                    {...field}
                    type='email'
                    placeholder='contact@example.com'
                    disabled={isPending}
                  />
                </DisabledFieldTooltip>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='phone'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone (optional)</FormLabel>
              <FormControl>
                <DisabledFieldTooltip
                  disabled={isPending}
                  reason={isPending ? pendingReason : null}
                >
                  <PhoneInput
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    disabled={isPending}
                  />
                </DisabledFieldTooltip>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
        <div className='border-border/40 bg-muted/95 supports-backdrop-filter:bg-muted/90 fixed right-0 bottom-0 z-50 w-full border-t shadow-lg backdrop-blur sm:max-w-lg'>
          <div className='flex w-full items-center justify-between gap-3 px-6 py-4'>
            <div className='flex items-center gap-2'>
              <DisabledFieldTooltip
                disabled={submitDisabled}
                reason={submitDisabledReason}
              >
                <Button
                  type='submit'
                  disabled={submitDisabled}
                  aria-label={`${saveLabel} (⌘S / Ctrl+S)`}
                  title={`${saveLabel} (⌘S / Ctrl+S)`}
                >
                  {saveLabel}
                </Button>
              </DisabledFieldTooltip>
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={undo}
                disabled={!canUndo}
                aria-label='Undo (⌘Z / Ctrl+Z)'
                title='Undo (⌘Z / Ctrl+Z)'
              >
                <Undo2 className='h-4 w-4' />
              </Button>
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={redo}
                disabled={!canRedo}
                aria-label='Redo (⇧⌘Z / Ctrl+Shift+Z)'
                title='Redo (⇧⌘Z / Ctrl+Shift+Z)'
              >
                <Redo2 className='h-4 w-4' />
              </Button>
            </div>
            {isEditing ? (
              <DisabledFieldTooltip
                disabled={deleteDisabled}
                reason={deleteDisabledReason}
              >
                <Button
                  type='button'
                  variant='destructive'
                  onClick={onRequestDelete}
                  disabled={deleteDisabled}
                  aria-label='Archive contact'
                  title='Archive contact'
                  size='icon'
                >
                  <Archive className='h-4 w-4' />
                </Button>
              </DisabledFieldTooltip>
            ) : null}
          </div>
        </div>
      </form>
    </Form>
  )
}
