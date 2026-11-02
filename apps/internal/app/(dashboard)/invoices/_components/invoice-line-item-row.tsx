'use client'

import { useMemo } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, TriangleAlert } from 'lucide-react'

import { Alert, AlertContent, AlertDescription } from '@pts/ui/alert'
import { RowActionButton } from '@pts/ui/row-action-button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FIELD_STACK_CLASS,
} from '@/components/ui/form'
import { Input } from '@pts/ui/input'
import { Label } from '@pts/ui/label'
import { formatCurrency } from '@pts/ui/numbers'
import {
  SearchableCombobox,
  type SearchableComboboxGroup,
} from '@/components/ui/searchable-combobox'
import { computeLineItemAmount } from '@/lib/invoices/invoice-form'
import type { InvoiceFormValues } from '@/lib/invoices/invoice-form'
import type { ProductCatalogOption } from '@/lib/invoices/invoice-options'
import { cn } from '@/lib/utils'

/** One invoice line item: catalog or custom, quantity, price, amount. */
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
  isNet30: boolean
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
  isNet30,
  dragHandleProps,
}: LineItemRowProps) {
  const quantity = useWatch({
    control: form.control,
    name: `lineItems.${index}.quantity`,
  })
  const unitPrice = useWatch({
    control: form.control,
    name: `lineItems.${index}.unitPrice`,
  })
  const createsHourBlock = useWatch({
    control: form.control,
    name: `lineItems.${index}.createsHourBlock`,
  })
  const productCatalogItemId = useWatch({
    control: form.control,
    name: `lineItems.${index}.productCatalogItemId`,
  })
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
        label: 'Product catalog',
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
          className='text-muted-foreground hover:bg-muted hover:text-foreground flex w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-lg transition-colors'
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
                      searchPlaceholder='Search items…'
                      emptyMessage='No items found.'
                      disabled={disabled}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {canRemove ? (
              <RowActionButton
                type='button'
                className='shrink-0'
                onClick={() => onRemove(index)}
                disabled={disabled}
                label={`Remove item ${index + 1}`}
                icon={<Trash2 />}
              />
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
        <div className='grid grid-cols-3 items-start gap-3'>
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
            <div className={FIELD_STACK_CLASS}>
              <Label className='text-xs'>Unit price</Label>
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
          <div className={FIELD_STACK_CLASS}>
            <Label className='text-xs'>Amount</Label>
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

        {/* Hour block label — only shown for catalog items that create hour blocks (not net_30) */}
        {isCatalogItem && createsHourBlock && !isNet30 ? (
          <p className='text-muted-foreground text-xs'>
            Creates hour block on payment
          </p>
        ) : null}

        {/* Min quantity advisory warning */}
        {showMinQuantityWarning ? (
          <Alert variant='warning' className='py-1.5 text-xs'>
            <TriangleAlert />
            <AlertContent>
              <AlertDescription>
                Recommended minimum: {minQuantity}{' '}
                {selectedProduct?.unitLabel ?? 'units'}.
              </AlertDescription>
            </AlertContent>
          </Alert>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sortable wrapper for drag-to-reorder
// ---------------------------------------------------------------------------

type SortableLineItemRowProps = LineItemRowProps & { id: string }

export function SortableLineItemRow({
  id,
  ...props
}: SortableLineItemRowProps) {
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
