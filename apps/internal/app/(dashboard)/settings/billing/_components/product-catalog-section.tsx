'use client'

import { useState, useCallback, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'

import { FormSection } from '@/components/forms/form-section'
import { EmptyState } from '@pts/ui/empty-state'
import { Checkbox } from '@pts/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
import { Input } from '@pts/ui/input'
import { formatCurrency } from '@pts/ui/numbers'
import { Label } from '@pts/ui/label'
import { Switch } from '@pts/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import {
  SortableTableHead,
  type SortValue,
} from '@/components/table-toolbar/sortable-table-head'
import { OptionalMarker } from '@/components/ui/form'
import { RecordRowAction } from '@/components/table/record-row-action'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import type { ProductCatalogItemRow } from '@/lib/queries/product-catalog'
import { parseSortParam } from '@/lib/pagination/sort'
import { sortRows } from '@/lib/table/sort-rows'

import { newRowId, RowChangeBadge, rowChange } from './row-change'
import { DialogForm } from '@/components/ui/dialog-form'

// Every column sorts; the default is Name A-Z.
const PRODUCT_SORT_FIELDS = [
  'name',
  'price',
  'unit',
  'minQty',
  'hourBlock',
  'active',
] as const
const DEFAULT_PRODUCT_SORT = { field: 'name', direction: 'asc' } as const

const DISCARD_TITLE = 'Discard changes?'
const DISCARD_DESCRIPTION =
  'You have unsaved product changes that will be lost. Continue without saving?'

const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  // The same rules Save checks (billingProductRowSchema), so a row the
  // dialog accepts never blocks the page's Save.
  unitPrice: z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter a unit price, like 200.00'),
  unitLabel: z.string().trim().min(1, 'Unit label is required').max(50),
  createsHourBlockDefault: z.boolean(),
  isActive: z.boolean(),
  minQuantity: z
    .string()
    .trim()
    .regex(/^\d{0,9}$/, 'Enter a whole number, or leave it empty')
    .optional(),
})

type ProductFormValues = z.infer<typeof productFormSchema>

type ProductRowProps = {
  item: ProductCatalogItemRow
  saved: ProductCatalogItemRow | undefined
  onEdit: (item: ProductCatalogItemRow) => void
  onToggleActive: (item: ProductCatalogItemRow) => void
  disabled: boolean
}

function ProductRow({
  item,
  saved,
  onEdit,
  onToggleActive,
  disabled,
}: ProductRowProps) {
  return (
    <TableRow>
      <TableCell className='truncate font-medium'>
        {item.name}
        <RowChangeBadge change={rowChange(item, saved)} />
      </TableCell>
      <TableCell label='Price' className='text-right tabular-nums'>
        {formatCurrency(item.unit_price)}
      </TableCell>
      <TableCell label='Unit' className='truncate md:pl-4'>
        {item.unit_label}
      </TableCell>
      <TableCell label='Min qty'>{item.min_quantity ?? '\u2014'}</TableCell>
      <TableCell label='Hour block'>
        {item.creates_hour_block_default ? 'Yes' : 'No'}
      </TableCell>
      <TableCell label='Active'>
        <Switch
          size='sm'
          checked={item.is_active}
          disabled={disabled}
          onCheckedChange={() => onToggleActive(item)}
        />
      </TableCell>
      <TableCell className='max-md:ml-auto'>
        <RecordRowAction
          kind='edit'
          entity='product'
          onClick={() => onEdit(item)}
        />
      </TableCell>
    </TableRow>
  )
}

type ProductCatalogSectionProps = {
  /** The rows as they stand in the page form. */
  items: ProductCatalogItemRow[]
  /** The rows as saved, so a new or changed one is marked until Save. */
  savedItems: ProductCatalogItemRow[]
  /** Changes the page form; nothing is written until the page's Save. */
  onItemsChange: (items: ProductCatalogItemRow[]) => void
  disabled: boolean
}

/**
 * The product catalog, edited in place: the dialog and the Active switch
 * change the page's form, and the page's Save writes them with everything
 * else on Settings → Billing.
 */
export function ProductCatalogSection({
  items,
  savedItems,
  onItemsChange,
  disabled,
}: ProductCatalogSectionProps) {
  const savedById = useMemo(
    () => new Map(savedItems.map(item => [item.id, item])),
    [savedItems]
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ProductCatalogItemRow | null>(
    null
  )
  // Local sort state: two small config tables share this page,
  // so sort stays out of the URL. undefined = the 'name:asc' default.
  const [sort, setSort] = useState<SortValue | undefined>(undefined)

  const sortedItems = useMemo(() => {
    const { field, direction } = parseSortParam(
      sort,
      PRODUCT_SORT_FIELDS,
      DEFAULT_PRODUCT_SORT
    )
    // Name A-Z first, so it breaks ties in every column.
    const byName = sortRows(items, item => item.name, 'asc')
    return sortRows(
      byName,
      item => {
        switch (field) {
          case 'price':
            return Number(item.unit_price)
          case 'unit':
            return item.unit_label
          case 'minQty':
            return item.min_quantity
          case 'hourBlock':
            return item.creates_hour_block_default
          case 'active':
            return item.is_active
          case 'name':
            return item.name
        }
      },
      direction
    )
  }, [items, sort])
  const sortHead = (
    field: (typeof PRODUCT_SORT_FIELDS)[number],
    label: string,
    className: string,
    align?: 'right'
  ) => (
    <SortableTableHead
      field={field}
      sort={sort}
      defaultSort='name:asc'
      onSortChange={setSort}
      className={className}
      align={align}
    >
      {label}
    </SortableTableHead>
  )

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      description: '',
      unitPrice: '',
      unitLabel: 'hour',
      createsHourBlockDefault: false,
      isActive: true,
      minQuantity: '',
    },
  })

  const isActive = useWatch({ control: form.control, name: 'isActive' })
  const createsHourBlockDefault = useWatch({
    control: form.control,
    name: 'createsHourBlockDefault',
  })

  const { requestConfirmation, dialog: discardDialog } =
    useUnsavedChangesWarning({
      isDirty: form.formState.isDirty,
      title: DISCARD_TITLE,
      description: DISCARD_DESCRIPTION,
    })

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setDialogOpen(true)
        return
      }
      requestConfirmation(() => setDialogOpen(false))
    },
    [requestConfirmation]
  )

  const openAddDialog = useCallback(() => {
    setEditingItem(null)
    form.reset({
      name: '',
      description: '',
      unitPrice: '',
      unitLabel: 'hour',
      createsHourBlockDefault: false,
      isActive: true,
      minQuantity: '',
    })
    setDialogOpen(true)
  }, [form])

  const openEditDialog = useCallback(
    (item: ProductCatalogItemRow) => {
      setEditingItem(item)
      form.reset({
        name: item.name,
        description: item.description ?? '',
        unitPrice: item.unit_price,
        unitLabel: item.unit_label,
        createsHourBlockDefault: item.creates_hour_block_default,
        isActive: item.is_active,
        minQuantity: item.min_quantity != null ? String(item.min_quantity) : '',
      })
      setDialogOpen(true)
    },
    [form]
  )

  const handleToggleActive = useCallback(
    (item: ProductCatalogItemRow) => {
      onItemsChange(
        items.map(p =>
          p.id === item.id ? { ...p, is_active: !p.is_active } : p
        )
      )
    },
    [items, onItemsChange]
  )

  const onSubmit = useCallback(
    (values: ProductFormValues) => {
      const minQty =
        values.minQuantity && values.minQuantity.trim() !== ''
          ? parseInt(values.minQuantity, 10)
          : null
      const fields = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        unit_price: values.unitPrice,
        unit_label: values.unitLabel.trim(),
        creates_hour_block_default: values.createsHourBlockDefault,
        is_active: values.isActive,
        min_quantity: minQty,
      }
      onItemsChange(
        editingItem
          ? items.map(p =>
              p.id === editingItem.id
                ? {
                    ...p,
                    ...fields,
                    // The same amount keeps the saved string ("200.00" vs
                    // "200"), so an untouched price isn't "Edited".
                    unit_price:
                      Number(p.unit_price) === Number(fields.unit_price)
                        ? p.unit_price
                        : fields.unit_price,
                  }
                : p
            )
          : [
              ...items,
              // A new row's id is local until Save creates it.
              { id: newRowId(), sort_order: items.length, ...fields },
            ]
      )
      form.reset(form.getValues())
      setDialogOpen(false)
    },
    [editingItem, form, items, onItemsChange]
  )

  return (
    <FormSection
      title='Product catalog'
      layout='block'
      action={
        <Button
          size='sm'
          type='button'
          onClick={openAddDialog}
          disabled={disabled}
        >
          <Plus />
          Create product
        </Button>
      }
    >
      <div className='rounded-lg border'>
        <Table
          density='compact'
          layout='fixed'
          stack
          className='md:min-w-[48rem]'
        >
          <TableHeader>
            <TableRow className='bg-muted/40'>
              {sortHead('name', 'Name', '')}
              {sortHead('price', 'Unit price', 'w-[12%]', 'right')}
              {/* p-0 plus the button's px-2: pl-2 lines the label up with
                  the cells' md:pl-4, clear of the right-aligned price. */}
              {sortHead('unit', 'Unit label', 'w-[11%] pl-2')}
              {sortHead('minQty', 'Min qty', 'w-[8%]')}
              {sortHead('hourBlock', 'Hour block', 'w-[11%]')}
              {sortHead('active', 'Active', 'w-[7%]')}
              <TableHead className='w-10' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className='p-4'>
                  <EmptyState message='No products yet.' />
                </TableCell>
              </TableRow>
            ) : (
              sortedItems.map(item => (
                <ProductRow
                  key={item.id}
                  item={item}
                  saved={savedById.get(item.id)}
                  onEdit={openEditDialog}
                  onToggleActive={handleToggleActive}
                  disabled={disabled}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit product' : 'Create product'}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? 'Change the product. It saves with the page.'
                : 'Add a product to the catalog. It saves with the page.'}
            </DialogDescription>
          </DialogHeader>

          {/* DialogForm keeps the submit from reaching the page's form. */}
          <DialogForm
            onSubmit={event => void form.handleSubmit(onSubmit)(event)}
            className='space-y-4'
          >
            <div className='flex items-center gap-3'>
              <Switch
                id='product-is-active'
                checked={isActive}
                onCheckedChange={(checked: boolean) =>
                  form.setValue('isActive', checked, { shouldDirty: true })
                }
              />
              <Label
                htmlFor='product-is-active'
                className='text-sm font-normal'
              >
                Active
              </Label>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='product-name'>Name</Label>
              <Input
                id='product-name'
                placeholder='e.g., Development Hours'
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className='text-destructive text-sm'>
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='product-description'>Description</Label>
              <Input
                id='product-description'
                placeholder='Optional description'
                {...form.register('description')}
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='product-unit-price'>Unit price</Label>
                <Input
                  id='product-unit-price'
                  placeholder='0.00'
                  {...form.register('unitPrice')}
                />
                {form.formState.errors.unitPrice && (
                  <p className='text-destructive text-sm'>
                    {form.formState.errors.unitPrice.message}
                  </p>
                )}
              </div>
              <div className='space-y-2'>
                <Label htmlFor='product-unit-label'>Unit label</Label>
                <Input
                  id='product-unit-label'
                  placeholder='hour'
                  {...form.register('unitLabel')}
                />
                {form.formState.errors.unitLabel && (
                  <p className='text-destructive text-sm'>
                    {form.formState.errors.unitLabel.message}
                  </p>
                )}
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='product-min-quantity'>
                Min quantity <OptionalMarker />
              </Label>
              <Input
                id='product-min-quantity'
                placeholder='e.g., 10'
                {...form.register('minQuantity')}
              />
              {form.formState.errors.minQuantity && (
                <p className='text-destructive text-sm'>
                  {form.formState.errors.minQuantity.message}
                </p>
              )}
            </div>

            <div className='flex items-start gap-3'>
              <Checkbox
                id='product-creates-hour-block'
                className='mt-0.5'
                checked={createsHourBlockDefault}
                onCheckedChange={(checked: boolean) =>
                  form.setValue('createsHourBlockDefault', checked === true, {
                    shouldDirty: true,
                  })
                }
              />
              <div className='space-y-1'>
                <Label
                  htmlFor='product-creates-hour-block'
                  className='text-sm font-normal'
                >
                  Creates hour block
                </Label>
                <p className='text-muted-foreground text-xs'>
                  Automatically creates a prepaid hour block for the client when
                  the invoice is paid.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => handleDialogOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type='submit'>
                {editingItem ? 'Update product' : 'Add product'}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>

      {discardDialog}
    </FormSection>
  )
}
