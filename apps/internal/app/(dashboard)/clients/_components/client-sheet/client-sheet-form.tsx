'use client'

import { useCallback, useMemo } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetSection } from '@/components/sheets/sheet-section'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { CompanyLinkPicker } from '@/components/companies/company-link-picker'
import { Separator } from '@pts/ui/separator'
import { FormFeedback } from '@/components/sheets/form-feedback'

import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import type { UseClientSheetStateReturn } from '@/lib/settings/clients/use-client-sheet-state'
import type { ClientSheetFormValues } from '@/lib/settings/clients/client-sheet-schema'
import { getSubmitLabel } from '@/lib/forms/form-controls'

import {
  ClientBillingFields,
  type ClientBillingFieldsProps,
} from './client-billing-fields'

const CLIENT_FORM_ID = 'client-form'

type ClientSheetFormProps = Omit<ClientBillingFieldsProps, 'isEditing'> & {
  form: UseFormReturn<ClientSheetFormValues>
  feedback: string | null
  submitDisabled: boolean
  submitDisabledReason: string | null
  onSubmit: UseClientSheetStateReturn['handleFormSubmit']
  isSheetOpen: boolean
  historyKey: string
}

/**
 * Make client: picks the company and sets up its billing. Editing a client
 * happens on its company's sheet (a client is the company's billing record).
 */
export function ClientSheetForm({
  form,
  feedback,
  submitDisabled,
  submitDisabledReason,
  onSubmit,
  isSheetOpen,
  historyKey,
  ...billing
}: ClientSheetFormProps) {
  const { isPending, pendingReason } = billing
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

  const saveLabel = useMemo(
    () =>
      getSubmitLabel({
        isSaving: isPending,
        isEditing: false,
        createLabel: 'Make client',
      }),
    [isPending]
  )

  return (
    <Form {...form}>
      <div className='flex-1 overflow-y-auto'>
        <form
          id={CLIENT_FORM_ID}
          onSubmit={form.handleSubmit(onSubmit)}
          className='flex flex-col gap-6 px-6 pt-6 pb-8'
        >
          <SheetSection title='Company'>
            <FormField
              control={form.control}
              name='companyId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <DisabledFieldTooltip
                      disabled={isPending}
                      reason={isPending ? pendingReason : null}
                    >
                      <CompanyLinkPicker
                        value={
                          field.value ? { id: field.value, name: '' } : null
                        }
                        onChange={next => field.onChange(next?.id ?? '')}
                        disabled={isPending}
                        placeholder='Pick or create the company'
                      />
                    </DisabledFieldTooltip>
                  </FormControl>
                  <p className='text-muted-foreground text-xs'>
                    A client is a company you bill. Its name, people and
                    billing all live on the company.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SheetSection>

          <Separator />

          <ClientBillingFields form={form} isEditing={false} {...billing} />

          <FormFeedback>{feedback}</FormFeedback>
        </form>
      </div>
      <SheetFormFooter
        formId={CLIENT_FORM_ID}
        saveLabel={saveLabel}
        submitDisabled={submitDisabled}
        submitDisabledReason={submitDisabledReason}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        isEditing={false}
        deleteDisabled
        deleteDisabledReason={null}
        onRequestDelete={() => {}}
        deleteAriaLabel='Archive client'
      />
    </Form>
  )
}
