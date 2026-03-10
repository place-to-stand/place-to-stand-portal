'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import {
  AlertTriangle,
  Archive,
  Plus,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react'

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { computeLineItemAmount } from '@/lib/invoices/invoice-form'
import type {
  ClientRow,
  InvoiceFormValues,
  InvoiceWithClient,
  ProductCatalogItemRow,
} from '@/lib/invoices/invoice-form'
import type { ProductCatalogOption } from '@/lib/invoices/invoice-options'
import { useInvoiceSheetState } from '@/lib/invoices/use-invoice-sheet-state'
import { cn } from '@/lib/utils'

import { InvoiceArchiveDialog } from './_components/invoice-archive-dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  invoice: InvoiceWithClient | null
  clients: ClientRow[]
  productCatalog: ProductCatalogItemRow[]
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)

export function InvoiceSheet({
  open,
  onOpenChange,
  onComplete,
  invoice,
  clients,
  productCatalog,
}: Props) {
  const {
    form,
    fieldArray,
    feedback,
    isEditing,
    isReadOnly,
    isPending,
    clientOptions,
    productCatalogOptions,
    clientField,
    standardField,
    submitButton,
    deleteButton,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    totals,
    handleSheetOpenChange,
    handleSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleAddLineItem,
    handleRemoveLineItem,
    handleProductSelect,
  } = useInvoiceSheetState({
    open,
    onOpenChange,
    onComplete,
    invoice,
    clients,
    productCatalog,
  })

  const handleSave = useCallback(
    () =>
      form.handleSubmit((values: InvoiceFormValues) =>
        handleSubmit(values),
      )(),
    [form, handleSubmit],
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls({
    form,
    isActive: open && !isReadOnly,
    canSave: !submitButton.disabled,
    onSave: handleSave,
    historyKey: invoice?.id ?? 'invoice:new',
  })

  const firstFieldRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open && !isPending && firstFieldRef.current) {
      const timeoutId = setTimeout(() => {
        firstFieldRef.current?.focus()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [open, isPending])

  const catalogItemMap = useMemo(
    () =>
      productCatalogOptions.reduce(
        (acc, item) => {
          acc[item.value] = item
          return acc
        },
        {} as Record<string, (typeof productCatalogOptions)[number]>,
      ),
    [productCatalogOptions],
  )

  const sheetTitle = isReadOnly
    ? `Invoice ${invoice?.invoice_number ?? 'details'}`
    : isEditing
      ? 'Edit invoice'
      : 'Create invoice'

  const sheetDescription = isReadOnly
    ? 'This invoice is view-only and cannot be modified.'
    : isEditing
      ? 'Update the invoice details and line items.'
      : 'Add details and line items for the new invoice.'

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto p-0 pb-32 sm:max-w-2xl'>
          <SheetHeader className='px-6 pt-6 pb-4'>
            <SheetTitle>{sheetTitle}</SheetTitle>
            <SheetDescription>{sheetDescription}</SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
                onSubmit={form.handleSubmit((values: InvoiceFormValues) =>
                  handleSubmit(values),
                )}
                className='flex flex-1 flex-col gap-5 px-6 pb-32'
              >
                {/* ───── Header Fields ───── */}
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
                              disabled={clientField.disabled || isReadOnly}
                            />
                          </DisabledFieldTooltip>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='dueDate'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Due date{' '}
                          <span className='text-muted-foreground text-xs'>
                            (optional)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <DisabledFieldTooltip
                            disabled={standardField.disabled}
                            reason={standardField.reason}
                          >
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              type='date'
                              disabled={standardField.disabled || isReadOnly}
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
                          disabled={standardField.disabled}
                          reason={standardField.reason}
                        >
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder='Payment terms, thank you message, etc.'
                            rows={2}
                            disabled={standardField.disabled || isReadOnly}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* ───── Line Items ───── */}
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <h3 className='text-sm font-medium'>Line items</h3>
                    {!isReadOnly ? (
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={handleAddLineItem}
                        disabled={standardField.disabled}
                        className='gap-1 text-xs'
                      >
                        <Plus className='h-3 w-3' />
                        Add item
                      </Button>
                    ) : null}
                  </div>

                  <FormMessage>
                    {form.formState.errors.lineItems?.message}
                  </FormMessage>

                  {fieldArray.fields.map((field, index) => (
                    <LineItemRow
                      key={field.id}
                      index={index}
                      form={form}
                      productCatalogOptions={productCatalogOptions}
                      catalogItemMap={catalogItemMap}
                      onProductSelect={handleProductSelect}
                      onRemove={handleRemoveLineItem}
                      canRemove={fieldArray.fields.length > 1}
                      disabled={standardField.disabled || isReadOnly}
                      isReadOnly={isReadOnly}
                    />
                  ))}
                </div>

                <Separator />

                {/* ───── Tax Rate ───── */}
                <FormField
                  control={form.control}
                  name='taxRate'
                  render={({ field }) => (
                    <FormItem className='max-w-xs'>
                      <FormLabel>Tax rate (%)</FormLabel>
                      <FormControl>
                        <DisabledFieldTooltip
                          disabled={standardField.disabled}
                          reason={standardField.reason}
                        >
                          <Input
                            {...field}
                            value={field.value ?? 0}
                            onChange={e =>
                              field.onChange(
                                e.target.value === ''
                                  ? 0
                                  : Number(e.target.value),
                              )
                            }
                            type='number'
                            step='0.01'
                            min='0'
                            max='100'
                            inputMode='decimal'
                            disabled={standardField.disabled || isReadOnly}
                          />
                        </DisabledFieldTooltip>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* ───── Totals ───── */}
                <div className='bg-muted/50 space-y-2 rounded-lg border p-4'>
                  <div className='flex justify-between text-sm'>
                    <span className='text-muted-foreground'>Subtotal</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {totals.taxAmount > 0 ? (
                    <div className='flex justify-between text-sm'>
                      <span className='text-muted-foreground'>
                        Tax ({form.getValues('taxRate')}%)
                      </span>
                      <span>{formatCurrency(totals.taxAmount)}</span>
                    </div>
                  ) : null}
                  <Separator />
                  <div className='flex justify-between font-semibold'>
                    <span>Total</span>
                    <span>{formatCurrency(totals.total)}</span>
                  </div>
                </div>

                {/* ───── Feedback ───── */}
                {feedback ? (
                  <p className='border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'>
                    {feedback}
                  </p>
                ) : null}

                {/* ───── Fixed Footer Bar ───── */}
                {!isReadOnly ? (
                  <div className='border-border/40 bg-muted/95 supports-backdrop-filter:bg-muted/90 fixed right-0 bottom-0 z-50 w-full border-t shadow-lg backdrop-blur sm:max-w-2xl'>
                    <div className='flex w-full items-center justify-between gap-3 px-6 py-4'>
                      <div className='flex items-center gap-2'>
                        <DisabledFieldTooltip
                          disabled={submitButton.disabled}
                          reason={submitButton.reason}
                        >
                          <Button
                            type='submit'
                            disabled={submitButton.disabled}
                            aria-label={`${submitButton.label} (⌘S / Ctrl+S)`}
                            title={`${submitButton.label} (⌘S / Ctrl+S)`}
                          >
                            {submitButton.label}
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
                          disabled={deleteButton.disabled}
                          reason={deleteButton.reason}
                        >
                          <Button
                            type='button'
                            variant='destructive'
                            size='icon'
                            title='Archive invoice'
                            aria-label='Archive invoice'
                            onClick={handleRequestDelete}
                            disabled={deleteButton.disabled}
                          >
                            <Archive className='h-4 w-4' />
                            <span className='sr-only'>Archive</span>
                          </Button>
                        </DisabledFieldTooltip>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </form>
          </Form>
        </SheetContent>
      </Sheet>
      <InvoiceArchiveDialog
        open={isDeleteDialogOpen}
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}

// ---------------------------------------------------------------------------
// Line Item Row
// ---------------------------------------------------------------------------

const MIN_HOUR_BLOCK_QUANTITY = 5

type LineItemRowProps = {
  index: number
  form: UseFormReturn<InvoiceFormValues>
  productCatalogOptions: ProductCatalogOption[]
  catalogItemMap: Record<string, ProductCatalogOption>
  onProductSelect: (index: number, productId: string) => void
  onRemove: (index: number) => void
  canRemove: boolean
  disabled: boolean
  isReadOnly: boolean
}

function LineItemRow({
  index,
  form,
  productCatalogOptions,
  onProductSelect,
  onRemove,
  canRemove,
  disabled,
  isReadOnly,
}: LineItemRowProps) {
  const quantity = form.watch(`lineItems.${index}.quantity`)
  const unitPrice = form.watch(`lineItems.${index}.unitPrice`)
  const createsHourBlock = form.watch(`lineItems.${index}.createsHourBlock`)
  const amount = computeLineItemAmount(quantity ?? 0, unitPrice ?? 0)

  const showMinHoursWarning =
    createsHourBlock && (quantity ?? 0) < MIN_HOUR_BLOCK_QUANTITY

  return (
    <div className='space-y-3 rounded-lg border p-4'>
      <div className='flex items-start justify-between gap-2'>
        <span className='text-muted-foreground text-xs font-medium'>
          Item {index + 1}
        </span>
        {!isReadOnly && canRemove ? (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='h-6 w-6'
            onClick={() => onRemove(index)}
            disabled={disabled}
            aria-label={`Remove item ${index + 1}`}
          >
            <Trash2 className='h-3 w-3' />
          </Button>
        ) : null}
      </div>

      {/* Product selector */}
      {!isReadOnly && productCatalogOptions.length > 0 ? (
        <FormField
          control={form.control}
          name={`lineItems.${index}.productCatalogItemId`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className='text-xs'>Product template</FormLabel>
              <FormControl>
                <SearchableCombobox
                  name={field.name}
                  value={field.value ?? ''}
                  onChange={value => onProductSelect(index, value)}
                  onBlur={field.onBlur}
                  items={productCatalogOptions}
                  searchPlaceholder='Select product...'
                  emptyMessage='No products found.'
                  placeholder='Choose a product (optional)'
                  disabled={disabled}
                />
              </FormControl>
            </FormItem>
          )}
        />
      ) : null}

      {/* Description */}
      <FormField
        control={form.control}
        name={`lineItems.${index}.description`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-xs'>Description</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder='Service or product description'
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Quantity + Unit Price + Amount */}
      <div className='grid grid-cols-3 gap-3'>
        <FormField
          control={form.control}
          name={`lineItems.${index}.quantity`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className='text-xs'>Qty</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  onChange={e =>
                    field.onChange(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                  type='number'
                  step='any'
                  min='0'
                  inputMode='decimal'
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`lineItems.${index}.unitPrice`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className='text-xs'>Unit price</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  onChange={e =>
                    field.onChange(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                  type='number'
                  step='0.01'
                  min='0'
                  inputMode='decimal'
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='space-y-1.5'>
          <label className='text-xs font-medium'>Amount</label>
          <div
            className={cn(
              'flex h-9 items-center rounded-md border px-3 text-sm',
              'bg-muted text-muted-foreground',
            )}
          >
            {formatCurrency(amount)}
          </div>
        </div>
      </div>

      {/* Creates Hour Block checkbox */}
      <FormField
        control={form.control}
        name={`lineItems.${index}.createsHourBlock`}
        render={({ field }) => (
          <FormItem className='flex items-center gap-2 space-y-0'>
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            </FormControl>
            <FormLabel className='text-xs font-normal'>
              Creates hour block on payment
            </FormLabel>
          </FormItem>
        )}
      />

      {/* Min hours warning */}
      {showMinHoursWarning ? (
        <div className='flex items-center gap-2 rounded-md border border-yellow-300/50 bg-yellow-50 px-3 py-1.5 text-xs text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-900/20 dark:text-yellow-300'>
          <AlertTriangle className='h-3 w-3 shrink-0' />
          Minimum billable block is {MIN_HOUR_BLOCK_QUANTITY} hours.
        </div>
      ) : null}
    </div>
  )
}
