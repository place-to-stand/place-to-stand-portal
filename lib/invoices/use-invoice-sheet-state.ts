'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import {
  useFieldArray,
  useForm,
  useWatch,
  type Resolver,
  type UseFormReturn,
  type UseFieldArrayReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  getInvoiceDetails,
  saveInvoice,
  archiveInvoice,
} from '@/app/(dashboard)/invoices/actions'
import { useToast } from '@/components/ui/use-toast'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'
import {
  buildInvoiceFormDefaults,
  computeInvoiceTotals,
  createEmptyLineItem,
  createInvoiceSavePayload,
  invoiceFormSchema,
  INVOICE_FORM_FIELDS,
  type ClientRow,
  type InvoiceFormValues,
  type InvoiceLineItemFormValues,
  type InvoiceWithClient,
  type InvoiceWithLineItems,
  type ProductCatalogItemRow,
} from './invoice-form'
import {
  buildClientOptions,
  buildProductCatalogOptions,
  type ClientOption,
  type ProductCatalogOption,
} from './invoice-options'
import {
  deriveClientFieldState,
  deriveDeleteButtonState,
  deriveStandardFieldState,
  deriveSubmitButtonState,
  isInvoiceEditable,
  type DeleteButtonState,
  type FieldState,
  type SubmitButtonState,
} from './invoice-ui-state'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UseInvoiceSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  invoice: InvoiceWithClient | null
  clients: ClientRow[]
  productCatalog: ProductCatalogItemRow[]
}

export type UseInvoiceSheetStateReturn = {
  form: UseFormReturn<InvoiceFormValues>
  fieldArray: UseFieldArrayReturn<InvoiceFormValues, 'lineItems', 'id'>
  feedback: string | null
  isEditing: boolean
  isReadOnly: boolean
  isPending: boolean
  clientOptions: ClientOption[]
  productCatalogOptions: ProductCatalogOption[]
  clientField: FieldState
  standardField: FieldState
  submitButton: SubmitButtonState
  deleteButton: DeleteButtonState
  isDeleteDialogOpen: boolean
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  totals: { subtotal: number; taxAmount: number; total: number }
  handleSheetOpenChange: (open: boolean) => void
  handleSubmit: (values: InvoiceFormValues) => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
  handleAddLineItem: () => void
  handleRemoveLineItem: (index: number) => void
  handleProductSelect: (index: number, productId: string) => void
  setFeedback: (value: string | null) => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInvoiceSheetState({
  open,
  onOpenChange,
  onComplete,
  invoice,
  clients,
  productCatalog,
}: UseInvoiceSheetStateArgs): UseInvoiceSheetStateReturn {
  const isEditing = Boolean(invoice)
  const invoiceStatus = invoice?.status ?? null
  const readOnly = !isInvoiceEditable(invoiceStatus)

  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const invoiceWithLineItemsRef = useRef<InvoiceWithLineItems | null>(null)
  const { toast } = useToast()

  const clientOptions = useMemo<ClientOption[]>(
    () => buildClientOptions(clients),
    [clients],
  )

  const productCatalogOptions = useMemo<ProductCatalogOption[]>(
    () => buildProductCatalogOptions(productCatalog),
    [productCatalog],
  )

  const resolver = zodResolver(
    invoiceFormSchema,
  ) as Resolver<InvoiceFormValues>

  const form = useForm<InvoiceFormValues>({
    resolver,
    defaultValues: buildInvoiceFormDefaults(null),
  })

  const fieldArray = useFieldArray({
    control: form.control,
    name: 'lineItems',
  })

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: form.formState.isDirty })

  // ---------------------------------------------------------------------------
  // Live totals computation via useWatch
  // ---------------------------------------------------------------------------

  const watchedLineItems = useWatch({
    control: form.control,
    name: 'lineItems',
  })
  const watchedTaxRate = useWatch({
    control: form.control,
    name: 'taxRate',
  })

  const totals = useMemo(() => {
    const items = (watchedLineItems ?? []).map(
      (li: InvoiceLineItemFormValues) => ({
        quantity: li.quantity ?? 0,
        unitPrice: li.unitPrice ?? 0,
      }),
    )
    return computeInvoiceTotals(items, watchedTaxRate ?? 0)
  }, [watchedLineItems, watchedTaxRate])

  // ---------------------------------------------------------------------------
  // Reset and load
  // ---------------------------------------------------------------------------

  const resetFormState = useCallback(
    (data: InvoiceWithLineItems | null) => {
      form.reset(buildInvoiceFormDefaults(data))
      form.clearErrors()
      setFeedback(null)
    },
    [form],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    if (!invoice) {
      // Create mode — check for proposal pre-fill data
      invoiceWithLineItemsRef.current = null

      let prefillData: InvoiceFormValues | null = null
      try {
        const raw =
          typeof window !== 'undefined'
            ? sessionStorage.getItem('invoice-prefill')
            : null
        if (raw) {
          sessionStorage.removeItem('invoice-prefill')
          const parsed = JSON.parse(raw) as InvoiceFormValues
          prefillData = parsed
        }
      } catch {
        // Ignore malformed sessionStorage data
      }

      startTransition(() => {
        if (prefillData) {
          form.reset(prefillData)
          form.clearErrors()
          setFeedback(null)
        } else {
          resetFormState(null)
        }
      })
      return
    }

    // Edit mode — fetch full invoice with line items.
    // React 19 async transitions keep isPending=true until resolved.
    startTransition(async () => {
      try {
        const fullInvoice = await getInvoiceDetails(invoice.id)
        invoiceWithLineItemsRef.current = fullInvoice
        resetFormState(fullInvoice)
      } catch {
        setFeedback('Unable to load invoice details.')
      }
    })
  }, [open, invoice, form, resetFormState, startTransition])

  // ---------------------------------------------------------------------------
  // Server field errors
  // ---------------------------------------------------------------------------

  const applyServerFieldErrors = useCallback(
    (fieldErrors?: Record<string, string[]>) => {
      if (!fieldErrors) return

      INVOICE_FORM_FIELDS.forEach(field => {
        const message = fieldErrors[field]?.[0]
        if (!message) return
        form.setError(field, { type: 'server', message })
      })
    },
    [form],
  )

  // ---------------------------------------------------------------------------
  // Sheet open/close
  // ---------------------------------------------------------------------------

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        confirmDiscard(() => {
          startTransition(() => {
            resetFormState(invoiceWithLineItemsRef.current)
          })
          onOpenChange(false)
        })
        return
      }

      onOpenChange(next)
    },
    [
      confirmDiscard,
      onOpenChange,
      resetFormState,
      startTransition,
    ],
  )

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(
    (values: InvoiceFormValues) => {
      if (readOnly) return

      startTransition(async () => {
        setFeedback(null)
        form.clearErrors()

        const payload = createInvoiceSavePayload(
          values,
          invoiceWithLineItemsRef.current,
        )

        const interaction = startSettingsInteraction({
          entity: 'invoice',
          mode: isEditing ? 'edit' : 'create',
          targetId: payload.id ?? null,
          metadata: {
            clientId: payload.clientId ?? null,
          },
        })

        try {
          const result = await saveInvoice(payload)

          applyServerFieldErrors(result.fieldErrors)

          if (result.error) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              error: result.error,
            })
            setFeedback(result.error)
            toast({
              title: 'Unable to save invoice',
              description: result.error,
              variant: 'destructive',
            })
            return
          }

          finishSettingsInteraction(interaction, {
            status: 'success',
            targetId: payload.id ?? null,
          })

          toast({
            title: isEditing ? 'Invoice updated' : 'Invoice created',
            description: isEditing
              ? 'Changes saved successfully.'
              : 'The invoice is ready to send.',
          })

          resetFormState(null)
          onOpenChange(false)
          onComplete()
        } catch (error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            error:
              error instanceof Error ? error.message : 'Unknown error',
          })
          setFeedback(
            'We could not save this invoice. Please try again.',
          )
          toast({
            title: 'Unable to save invoice',
            description:
              error instanceof Error ? error.message : 'Unknown error.',
            variant: 'destructive',
          })
        }
      })
    },
    [
      applyServerFieldErrors,
      form,
      isEditing,
      onComplete,
      onOpenChange,
      readOnly,
      resetFormState,
      startTransition,
      toast,
    ],
  )

  // ---------------------------------------------------------------------------
  // Delete (archive)
  // ---------------------------------------------------------------------------

  const handleRequestDelete = useCallback(() => {
    if (!invoice || invoice.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(true)
  }, [invoice, isPending])

  const handleCancelDelete = useCallback(() => {
    if (isPending) return
    setIsDeleteDialogOpen(false)
  }, [isPending])

  const handleConfirmDelete = useCallback(() => {
    if (!invoice || invoice.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
    startTransition(async () => {
      setFeedback(null)
      form.clearErrors()

      const interaction = startSettingsInteraction({
        entity: 'invoice',
        mode: 'delete',
        targetId: invoice.id,
        metadata: {
          clientId: invoice.client_id ?? null,
        },
      })

      try {
        const result = await archiveInvoice({ id: invoice.id })

        if (result.error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            targetId: invoice.id,
            error: result.error,
          })
          setFeedback(result.error)
          toast({
            title: 'Unable to archive invoice',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        finishSettingsInteraction(interaction, {
          status: 'success',
          targetId: invoice.id,
        })

        toast({
          title: 'Invoice archived',
          description:
            'It will be hidden from active views but remains available historically.',
        })

        onOpenChange(false)
        onComplete()
      } catch (error) {
        finishSettingsInteraction(interaction, {
          status: 'error',
          targetId: invoice.id,
          error:
            error instanceof Error ? error.message : 'Unknown error',
        })
        setFeedback(
          'We could not archive this invoice. Please try again.',
        )
        toast({
          title: 'Unable to archive invoice',
          description:
            error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        })
      }
    })
  }, [
    form,
    invoice,
    isPending,
    onComplete,
    onOpenChange,
    startTransition,
    toast,
  ])

  // ---------------------------------------------------------------------------
  // Line item helpers
  // ---------------------------------------------------------------------------

  const handleAddLineItem = useCallback(() => {
    fieldArray.append(createEmptyLineItem())
  }, [fieldArray])

  const handleRemoveLineItem = useCallback(
    (index: number) => {
      if (fieldArray.fields.length <= 1) return
      fieldArray.remove(index)
    },
    [fieldArray],
  )

  const handleProductSelect = useCallback(
    (index: number, productId: string) => {
      const product = productCatalog.find(p => p.id === productId)
      if (!product) return

      form.setValue(`lineItems.${index}.productCatalogItemId`, productId, {
        shouldDirty: true,
      })
      form.setValue(`lineItems.${index}.description`, product.name, {
        shouldDirty: true,
      })
      form.setValue(
        `lineItems.${index}.unitPrice`,
        Number(product.unit_price),
        { shouldDirty: true },
      )
      form.setValue(
        `lineItems.${index}.createsHourBlock`,
        product.creates_hour_block_default,
        { shouldDirty: true },
      )
    },
    [form, productCatalog],
  )

  // ---------------------------------------------------------------------------
  // Derived field states
  // ---------------------------------------------------------------------------

  const clientField: FieldState = useMemo(
    () => deriveClientFieldState(isPending, clientOptions, invoiceStatus),
    [clientOptions, invoiceStatus, isPending],
  )

  const standardField: FieldState = useMemo(
    () => deriveStandardFieldState(isPending, invoiceStatus),
    [invoiceStatus, isPending],
  )

  const submitButton: SubmitButtonState = useMemo(
    () =>
      deriveSubmitButtonState(
        isPending,
        isEditing,
        clientOptions,
        invoiceStatus,
      ),
    [clientOptions, invoiceStatus, isEditing, isPending],
  )

  const deleteButton: DeleteButtonState = useMemo(
    () => deriveDeleteButtonState(isEditing, isPending, invoice),
    [invoice, isEditing, isPending],
  )

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    form,
    fieldArray,
    feedback,
    isEditing,
    isReadOnly: readOnly,
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
    setFeedback,
  }
}
