'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertTriangle,
  Archive,
  GripVertical,
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
import {
  SearchableCombobox,
  type SearchableComboboxGroup,
} from '@/components/ui/searchable-combobox'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { computeLineItemAmount } from '@/lib/invoices/invoice-form'
import type {
  ClientRow,
  InvoiceFormValues,
  InvoiceWithClient,
  ProductCatalogItemRow,
} from '@/lib/invoices/invoice-form'
import type { ProductCatalogOption } from '@/lib/invoices/invoice-options'
import {
  useInvoiceSheetState,
  type TaxRateData,
} from '@/lib/invoices/use-invoice-sheet-state'
import { cn } from '@/lib/utils'

import { InvoiceArchiveDialog } from './_components/invoice-archive-dialog'
import { InvoiceSheetRightColumn } from './_components/invoice-sheet-right-column'
import { InvoiceVoidDialog } from './_components/invoice-void-dialog'
import { sendInvoiceAction, unsendInvoice, voidInvoice } from './actions'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  invoice: InvoiceWithClient | null
  clients: ClientRow[]
  productCatalog: ProductCatalogItemRow[]
  taxRates: TaxRateData[]
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
  taxRates,
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
    taxRateLabel,
    handleSheetOpenChange,
    handleSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleAddLineItem,
    handleRemoveLineItem,
    handleMoveLineItem,
    handleProductSelect,
  } = useInvoiceSheetState({
    open,
    onOpenChange,
    onComplete,
    invoice,
    clients,
    productCatalog,
    taxRates,
  })

  const router = useRouter()
  const { toast } = useToast()
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [actionPending, setActionPending] = useState(false)

  const handleSave = useCallback(
    () =>
      form.handleSubmit((values: InvoiceFormValues) => handleSubmit(values))(),
    [form, handleSubmit]
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

  // Determine whether to show the due date field based on client billing type
  const watchedClientId = useWatch({ control: form.control, name: 'clientId' })
  const selectedClientBillingType = useMemo(() => {
    if (!watchedClientId) return null
    const option = clientOptions.find(c => c.value === watchedClientId)
    return option?.billingType ?? null
  }, [watchedClientId, clientOptions])
  const showDueDate =
    selectedClientBillingType === 'net_30' || (isEditing && invoice?.due_date)

  const catalogItemMap = useMemo(
    () =>
      productCatalogOptions.reduce(
        (acc, item) => {
          acc[item.value] = item
          return acc
        },
        {} as Record<string, (typeof productCatalogOptions)[number]>
      ),
    [productCatalogOptions]
  )

  // dnd-kit sensors for line item reorder
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const lineItemIds = useMemo(
    () => fieldArray.fields.map(f => f.id),
    [fieldArray.fields]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const fromIndex = lineItemIds.indexOf(active.id as string)
      const toIndex = lineItemIds.indexOf(over.id as string)
      if (fromIndex !== -1 && toIndex !== -1) {
        handleMoveLineItem(fromIndex, toIndex)
      }
    },
    [lineItemIds, handleMoveLineItem]
  )

  // ── Right-column action handlers ──────────────────────────────────────

  const handleSendInvoice = useCallback(async () => {
    if (!invoice) return
    setActionPending(true)
    try {
      const result = await sendInvoiceAction({ id: invoice.id })
      if (result.error) {
        toast({
          title: 'Unable to mark invoice as sent',
          description: result.error,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Invoice marked as sent',
          description: `Invoice ${result.invoiceNumber ?? ''} has been assigned and marked as sent.`,
        })
        router.refresh()
      }
    } catch {
      toast({
        title: 'Unable to mark invoice as sent',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setActionPending(false)
    }
  }, [invoice, toast, router])

  const handleUnsendInvoice = useCallback(async () => {
    if (!invoice) return
    setActionPending(true)
    try {
      const result = await unsendInvoice({ id: invoice.id })
      if (result.error) {
        toast({
          title: 'Unable to revert invoice to draft',
          description: result.error,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Invoice reverted to draft',
          description: 'The invoice has been marked as unsent.',
        })
        router.refresh()
      }
    } catch {
      toast({
        title: 'Unable to revert invoice to draft',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setActionPending(false)
    }
  }, [invoice, toast, router])

  const handleRequestVoid = useCallback(() => {
    setVoidDialogOpen(true)
  }, [])

  const handleCancelVoid = useCallback(() => {
    setVoidDialogOpen(false)
  }, [])

  const handleConfirmVoid = useCallback(async () => {
    if (!invoice) return
    setVoidDialogOpen(false)
    setActionPending(true)
    try {
      const result = await voidInvoice({ id: invoice.id })
      if (result.error) {
        toast({
          title: 'Unable to void invoice',
          description: result.error,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Invoice voided',
          description: 'The invoice has been marked as void.',
        })
        router.refresh()
      }
    } catch {
      toast({
        title: 'Unable to void invoice',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setActionPending(false)
    }
  }, [invoice, toast, router])

  // ── Titles ────────────────────────────────────────────────────────────

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

  const combinedPending = isPending || actionPending

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl'>
          <Form {...form}>
            <form
              className='flex min-h-0 flex-1 flex-col'
              onSubmit={form.handleSubmit((values: InvoiceFormValues) =>
                handleSubmit(values)
              )}
            >
              {/* ────────────────────────────────────────────────────── */}
              {/* Header (full width)                                   */}
              {/* ────────────────────────────────────────────────────── */}
              <SheetHeader className='flex-shrink-0 border-b px-6 pt-6 pb-4'>
                <SheetTitle>{sheetTitle}</SheetTitle>
                <SheetDescription>{sheetDescription}</SheetDescription>
              </SheetHeader>

              {/* ────────────────────────────────────────────────────── */}
              {/* Two-column body                                       */}
              {/* ────────────────────────────────────────────────────── */}
              <div className='flex min-h-0 flex-1'>
                {/* Left Column - Form Fields */}
                <div className='flex flex-1 flex-col overflow-hidden border-r'>
                  {/* Scrollable form body */}
                  <div className='flex-1 overflow-y-auto p-6'>
                    <div className='flex flex-col gap-5'>
                      {/* ───── Header Fields ───── */}
                      <div className='grid gap-x-4 gap-y-2 sm:grid-cols-2'>
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
                                    disabled={
                                      clientField.disabled || isReadOnly
                                    }
                                  />
                                </DisabledFieldTooltip>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {showDueDate ? (
                          <FormField
                            control={form.control}
                            name='dueDate'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Due date</FormLabel>
                                <FormControl>
                                  <DisabledFieldTooltip
                                    disabled={standardField.disabled}
                                    reason={standardField.reason}
                                  >
                                    <Input
                                      {...field}
                                      value={field.value ?? ''}
                                      type='date'
                                      disabled={
                                        standardField.disabled || isReadOnly
                                      }
                                    />
                                  </DisabledFieldTooltip>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : null}
                        {selectedClientBillingType === 'net_30' ? (
                          <p className='text-muted-foreground text-[0.8rem] sm:col-span-2'>
                            Net 30 — due date auto-set to 30 days from today.
                          </p>
                        ) : null}
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
                                  disabled={
                                    standardField.disabled || isReadOnly
                                  }
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

                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={lineItemIds}
                            strategy={verticalListSortingStrategy}
                          >
                            {fieldArray.fields.map((field, index) => (
                              <SortableLineItemRow
                                key={field.id}
                                id={field.id}
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
                          </SortableContext>
                        </DndContext>
                      </div>

                      <Separator />

                      {/* ───── Tax Rate (read-only, driven by client state) ───── */}
                      <div className='grid items-center gap-4 sm:grid-cols-2'>
                        <span className='text-sm font-medium sm:text-right'>
                          {taxRateLabel ?? 'Tax rate'}
                        </span>
                        <div
                          className={cn(
                            'flex h-9 items-center rounded-md border px-3 text-sm',
                            'bg-muted text-muted-foreground'
                          )}
                        >
                          {form.getValues('taxRate') ?? 0}%
                        </div>
                      </div>

                      {/* ───── Totals ───── */}
                      <div className='bg-muted/50 space-y-2 rounded-lg border p-4'>
                        <div className='flex justify-between text-sm'>
                          <span className='text-muted-foreground'>
                            Subtotal
                          </span>
                          <span>{formatCurrency(totals.subtotal)}</span>
                        </div>
                        {totals.taxAmount > 0 ? (
                          <div className='flex justify-between text-sm'>
                            <span className='text-muted-foreground'>
                              {taxRateLabel ?? 'Tax'}
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
                    </div>
                  </div>
                </div>

                {/* ────────────────────────────────────────────────────── */}
                {/* Right Column - Actions & Metadata / Placeholder       */}
                {/* ────────────────────────────────────────────────────── */}
                {isEditing && invoice ? (
                  <InvoiceSheetRightColumn
                    invoice={invoice}
                    isPending={combinedPending}
                    onSendInvoice={handleSendInvoice}
                    onUnsendInvoice={handleUnsendInvoice}
                    onVoidInvoice={handleRequestVoid}
                  />
                ) : (
                  <div className='bg-muted/20 w-80 flex-shrink-0 lg:w-96'>
                    <div className='flex h-full flex-col items-center justify-center p-6 text-center'>
                      <p className='text-muted-foreground text-sm'>
                        Save the invoice to access sharing, status actions, and
                        other details.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ────────────────────────────────────────────────────── */}
              {/* Footer (full width)                                   */}
              {/* ────────────────────────────────────────────────────── */}
              {!isReadOnly ? (
                <div className='bg-muted/50 flex-shrink-0 border-t px-6 py-4'>
                  <div className='flex w-full items-center justify-between gap-3'>
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

      {/* Dialogs */}
      <InvoiceArchiveDialog
        open={isDeleteDialogOpen}
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      <InvoiceVoidDialog
        open={voidDialogOpen}
        confirmDisabled={combinedPending}
        onCancel={handleCancelVoid}
        onConfirm={handleConfirmVoid}
      />
      {unsavedChangesDialog}
    </>
  )
}

// ---------------------------------------------------------------------------
// Line Item Row
// ---------------------------------------------------------------------------

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
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
}

const CUSTOM_ITEM_VALUE = '__custom__'

function LineItemRow({
  index,
  form,
  productCatalogOptions,
  catalogItemMap,
  onProductSelect,
  onRemove,
  canRemove,
  disabled,
  isReadOnly,
  dragHandleProps,
}: LineItemRowProps) {
  const quantity = useWatch({ control: form.control, name: `lineItems.${index}.quantity` })
  const unitPrice = useWatch({ control: form.control, name: `lineItems.${index}.unitPrice` })
  const createsHourBlock = useWatch({ control: form.control, name: `lineItems.${index}.createsHourBlock` })
  const productCatalogItemId = useWatch({ control: form.control, name: `lineItems.${index}.productCatalogItemId` })
  const amount = computeLineItemAmount(quantity ?? 0, unitPrice ?? 0)

  const isCatalogItem = Boolean(productCatalogItemId)
  const selectedProduct = productCatalogItemId
    ? catalogItemMap[productCatalogItemId]
    : null
  const minQuantity = selectedProduct?.minQuantity ?? null
  const showMinQuantityWarning =
    createsHourBlock && minQuantity !== null && (quantity ?? 0) < minQuantity

  // Build grouped options: "Custom" group + "Product Catalog" group
  const productGroups = useMemo<SearchableComboboxGroup[]>(() => {
    const groups: SearchableComboboxGroup[] = [
      {
        label: 'Options',
        items: [
          {
            value: CUSTOM_ITEM_VALUE,
            label: 'Custom item',
            keywords: ['custom', 'manual'],
          },
        ],
      },
    ]
    if (productCatalogOptions.length > 0) {
      groups.push({
        label: 'Product Catalog',
        items: productCatalogOptions.map(opt => ({
          ...opt,
          description: formatCurrency(Number(opt.unitPrice)),
        })),
      })
    }
    return groups
  }, [productCatalogOptions])

  // The combobox value: catalog item ID, or "__custom__" for custom items
  const selectorValue = productCatalogItemId ?? CUSTOM_ITEM_VALUE

  return (
    <div className='flex rounded-lg border'>
      {/* Drag handle — full-height left edge */}
      {dragHandleProps && !isReadOnly ? (
        <button
          type='button'
          className='text-muted-foreground hover:bg-muted hover:text-foreground flex w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-lg border-r transition-colors'
          {...dragHandleProps}
        >
          <GripVertical className='h-4 w-4' />
        </button>
      ) : null}

      {/* Content */}
      <div className='flex-1 space-y-3 p-4'>
        {/* Product / Custom selector + remove button */}
      {!isReadOnly ? (
        <div className='flex items-end gap-2'>
          <FormField
            control={form.control}
            name={`lineItems.${index}.productCatalogItemId`}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormLabel className='text-xs'>Item type</FormLabel>
                <FormControl>
                  <SearchableCombobox
                    name={field.name}
                    value={selectorValue}
                    onChange={value => onProductSelect(index, value)}
                    onBlur={field.onBlur}
                    groups={productGroups}
                    searchPlaceholder='Search items...'
                    emptyMessage='No items found.'
                    disabled={disabled}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          {canRemove ? (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='h-9 w-9 shrink-0'
              onClick={() => onRemove(index)}
              disabled={disabled}
              aria-label={`Remove item ${index + 1}`}
            >
              <Trash2 className='h-3.5 w-3.5' />
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Description — only shown for custom items */}
      {!isCatalogItem ? (
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
      ) : null}

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
                      e.target.value === '' ? '' : Number(e.target.value)
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
        {isCatalogItem ? (
          <div className='space-y-1.5'>
            <label className='text-xs font-medium'>Unit price</label>
            <div
              className={cn(
                'flex h-9 items-center rounded-md border px-3 text-sm',
                'bg-muted text-muted-foreground'
              )}
            >
              {formatCurrency(unitPrice ?? 0)}
            </div>
          </div>
        ) : (
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
                        e.target.value === '' ? '' : Number(e.target.value)
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
        )}
        <div className='space-y-1.5'>
          <label className='text-xs font-medium'>Amount</label>
          <div
            className={cn(
              'flex h-9 items-center rounded-md border px-3 text-sm',
              'bg-muted text-muted-foreground'
            )}
          >
            {formatCurrency(amount)}
          </div>
        </div>
      </div>

      {/* Hour block label — only shown for catalog items that create hour blocks */}
      {isCatalogItem && createsHourBlock ? (
        <p className='text-muted-foreground text-xs'>
          Creates hour block on payment
        </p>
      ) : null}

      {/* Min quantity advisory warning */}
      {showMinQuantityWarning ? (
        <div className='flex items-center gap-2 rounded-md border border-yellow-300/50 bg-yellow-50 px-3 py-1.5 text-xs text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-900/20 dark:text-yellow-300'>
          <AlertTriangle className='h-3 w-3 shrink-0' />
          Recommended minimum: {minQuantity}{' '}
          {selectedProduct?.unitLabel ?? 'units'}.
        </div>
      ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sortable wrapper for drag-to-reorder
// ---------------------------------------------------------------------------

type SortableLineItemRowProps = LineItemRowProps & { id: string }

function SortableLineItemRow({ id, ...props }: SortableLineItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <LineItemRow
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}
