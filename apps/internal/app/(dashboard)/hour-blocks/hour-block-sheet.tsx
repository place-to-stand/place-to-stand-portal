'use client'

import { useCallback, useEffect, useRef } from 'react'

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
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import {
  useHourBlockSheetState,
  type HourBlockFormValues,
} from '@/lib/settings/hour-blocks/use-hour-block-sheet-state'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import type {
  ClientRow,
  HourBlockInvoiceRow,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'
import { HourBlockArchiveDialog } from './_components/hour-block-archive-dialog'

const HOUR_BLOCK_FORM_ID = 'hour-block-form'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  hourBlock: HourBlockWithClient | null
  clients: ClientRow[]
  invoices: HourBlockInvoiceRow[]
}

export function HourBlockSheet({
  open,
  onOpenChange,
  onComplete,
  hourBlock,
  clients,
  invoices,
}: Props) {
  const {
    form,
    feedback,
    isEditing,
    isPending,
    clientOptions,
    invoiceOptions,
    clientField,
    hoursField,
    invoiceField,
    submitButton,
    deleteButton,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  } = useHourBlockSheetState({
    open,
    onOpenChange,
    onComplete,
    hourBlock,
    clients,
    invoices,
  })

  const handleSave = useCallback(
    () =>
      form.handleSubmit((values: HourBlockFormValues) =>
        handleSubmit(values)
      )(),
    [form, handleSubmit]
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls({
    form,
    isActive: open,
    canSave: !submitButton.disabled,
    onSave: handleSave,
    historyKey: hourBlock?.id ?? 'hour-block:new',
  })

  const firstFieldRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open && firstFieldRef.current) {
      // Small delay to ensure sheet animation completes
      const timeoutId = setTimeout(() => {
        firstFieldRef.current?.focus()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [open])

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          hideCloseButton
          size='lg'
          className='flex w-full flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader
            entity='hourBlock'
            title={isEditing ? 'Edit hour block' : 'Add hour block'}
          />
          <Form {...form}>
            <div className='flex-1 overflow-y-auto'>
              <form
                id={HOUR_BLOCK_FORM_ID}
                onSubmit={form.handleSubmit((values: HourBlockFormValues) =>
                  handleSubmit(values)
                )}
                className='flex flex-col gap-5 px-6 pt-6 pb-8'
              >
                <div className='grid gap-4 sm:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='clientId'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <FormControl>
                          <DisabledFieldTooltip
                            disabled={clientField.disabled}
                            reason={clientField.reason}
                          >
                            <SearchableCombobox
                              ref={firstFieldRef}
                              name={field.name}
                              value={field.value ?? ''}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              items={clientOptions}
                              searchPlaceholder='Search clients...'
                              emptyMessage='No clients found.'
                              disabled={clientField.disabled}
                            />
                          </DisabledFieldTooltip>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='hoursPurchased'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hours purchased</FormLabel>
                        <FormControl>
                          <DisabledFieldTooltip
                            disabled={hoursField.disabled}
                            reason={hoursField.reason}
                          >
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              type='number'
                              step='1'
                              min='1'
                              inputMode='numeric'
                              disabled={hoursField.disabled}
                            />
                          </DisabledFieldTooltip>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name='invoiceId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Invoice{' '}
                        <span className='text-muted-foreground text-xs'>
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={invoiceField.disabled}
                          reason={invoiceField.reason}
                        >
                          <SearchableCombobox
                            name={field.name}
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            items={invoiceOptions}
                            placeholder='No invoice'
                            searchPlaceholder='Search invoices...'
                            emptyMessage='No invoices found for this client.'
                            disabled={invoiceField.disabled}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='notes'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Notes{' '}
                        <span className='text-muted-foreground text-xs'>
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={invoiceField.disabled}
                          reason={invoiceField.reason}
                        >
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder='e.g. Comped 2 hours for leaving a review'
                            rows={3}
                            disabled={invoiceField.disabled}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {feedback ? (
                  <p className='border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'>
                    {feedback}
                  </p>
                ) : null}
              </form>
            </div>
            <SheetFormFooter
              formId={HOUR_BLOCK_FORM_ID}
              saveLabel={submitButton.label}
              submitDisabled={submitButton.disabled}
              submitDisabledReason={submitButton.reason}
              undo={undo}
              redo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              isEditing={isEditing}
              deleteDisabled={deleteButton.disabled}
              deleteDisabledReason={deleteButton.reason}
              onRequestDelete={handleRequestDelete}
              deleteAriaLabel='Archive hour block'
            />
          </Form>
        </SheetContent>
      </Sheet>
      <HourBlockArchiveDialog
        open={isDeleteDialogOpen}
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}
