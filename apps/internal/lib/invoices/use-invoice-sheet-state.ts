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

import { saveInvoice, archiveInvoice } from '@/app/(dashboard)/invoices/actions'
import { toastLink, useToast } from '@/components/ui/use-toast'
import { getJson } from '@/lib/http/get-json'
import type { SheetSaveMode } from '@/lib/sheets/save-mode'
import { useSaveAndStay } from '@/lib/sheets/use-save-and-stay'
import {
  useSheetLifecycle,
  type SheetLifecycle,
} from '@/lib/sheets/use-sheet-lifecycle'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'
import {
  buildInvoiceFormDefaults,
  computeInvoiceTotals,
  createEmptyLineItem,
  createLineItemFromCatalog,
  createInvoiceSavePayload,
  invoiceFormSchema,
  INVOICE_FORM_FIELDS,
  keptLineItems,
  type InvoiceClient,
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

export type TaxRateData = {
  state: string
  rate: string
  label: string
}

export type UseInvoiceSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  invoice: InvoiceWithClient | null
  /** Create a new invoice filled in from this one (Duplicate). */
  duplicateOf?: InvoiceWithClient | null
  clients: InvoiceClient[]
  productCatalog: ProductCatalogItemRow[]
  taxRates: TaxRateData[]
}

export type UseInvoiceSheetStateReturn = {
  form: UseFormReturn<InvoiceFormValues>
  fieldArray: UseFieldArrayReturn<InvoiceFormValues, 'lineItems', 'id'>
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
  unsavedChangesDialog: SheetLifecycle['unsavedChangesDialog']
  confirmDiscard: SheetLifecycle['confirmDiscard']
  totals: { subtotal: number; taxAmount: number; total: number }
  taxRateLabel: string | null
  handleSheetOpenChange: (open: boolean) => void
  handleSubmit: (values: InvoiceFormValues, mode?: SheetSaveMode) => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
  handleAddLineItem: () => void
  handleRemoveLineItem: (index: number) => void
  handleRestoreLineItem: (index: number) => void
  /** Lines that will be saved (not pending removal). */
  keptLineItemCount: number
  handleMoveLineItem: (fromIndex: number, toIndex: number) => void
  handleProductSelect: (index: number, productId: string) => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const loadInvoice = (id: string) =>
  getJson<InvoiceWithLineItems>(`/api/invoices/${id}`)

export function useInvoiceSheetState({
  open,
  onOpenChange,
  onComplete,
  invoice,
  duplicateOf = null,
  clients,
  productCatalog,
  taxRates,
}: UseInvoiceSheetStateArgs): UseInvoiceSheetStateReturn {
  const isEditing = Boolean(invoice)
  const invoiceStatus = invoice?.status ?? null
  const readOnly = !isInvoiceEditable(invoiceStatus)

  // `isLoading` is the open-time fetch of line items: it blocks submit (you
  // can't save a half-loaded form) but is not a save, so it never reaches the
  // button label. The save transition and the quiet one come from
  // useSheetLifecycle.
  const [isLoading, startLoadTransition] = useTransition()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const invoiceWithLineItemsRef = useRef<InvoiceWithLineItems | null>(null)
  // Track the client ID loaded from the database / pre-fill so we only
  // auto-fill when the user actively picks a *different* client.
  const loadedClientIdRef = useRef<string | null>(null)
  // Read inside the load effect without re-running it (a new callback each
  // render would reset the form mid-edit).
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])
  const { toast } = useToast()

  const clientOptions = useMemo<ClientOption[]>(
    () => buildClientOptions(clients),
    [clients]
  )

  const productCatalogOptions = useMemo<ProductCatalogOption[]>(
    () => buildProductCatalogOptions(productCatalog),
    [productCatalog]
  )

  const resolver = zodResolver(invoiceFormSchema) as Resolver<InvoiceFormValues>

  const form = useForm<InvoiceFormValues>({
    resolver,
    defaultValues: buildInvoiceFormDefaults(null),
  })

  const fieldArray = useFieldArray({
    control: form.control,
    name: 'lineItems',
  })

  const resetFormState = useCallback(
    (data: InvoiceWithLineItems | null) => {
      form.reset(buildInvoiceFormDefaults(data))
      form.clearErrors()
    },
    [form]
  )

  const resetToLoadedInvoice = useCallback(() => {
    resetFormState(invoiceWithLineItemsRef.current)
  }, [resetFormState])

  const {
    isSaving: isPending,
    startSave,
    startQuiet: startResetTransition,
    handleSheetOpenChange,
    unsavedChangesDialog,
    confirmDiscard,
  } = useSheetLifecycle({
    open,
    onOpenChange,
    isDirty: form.formState.isDirty,
    onReset: resetToLoadedInvoice,
    // The open path builds its own state (prefill, catalog defaults, or the
    // line-item fetch below), so the hook only handles the post-close reset.
    resetOnOpen: false,
  })

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
    const items = keptLineItems(watchedLineItems ?? []).map(
      (li: InvoiceLineItemFormValues) => ({
        quantity: li.quantity ?? 0,
        unitPrice: li.unitPrice ?? 0,
      })
    )
    return computeInvoiceTotals(items, watchedTaxRate ?? 0)
  }, [watchedLineItems, watchedTaxRate])

  // ---------------------------------------------------------------------------
  // Reset and load
  // ---------------------------------------------------------------------------

  // Load by version, not by object: a refresh hands over a new but equal
  // `invoice`, and reloading the version already shown (e.g. the one a
  // keep-open save just read back) would overwrite edits made since.
  const invoiceId = invoice?.id ?? null
  const duplicateOfId = duplicateOf?.id ?? null
  const invoiceVersion = invoice ? `${invoice.id}:${invoice.updated_at}` : null
  const shownVersion = useRef<string | null>(null)
  useEffect(() => {
    if (!open) {
      shownVersion.current = null
      return
    }
    if (invoiceVersion && invoiceVersion === shownVersion.current) {
      return
    }

    if (!invoiceId && duplicateOfId) {
      // Duplicate — a new draft with the source's client, notes, tax and
      // lines. Line ids are dropped so saving inserts fresh rows.
      invoiceWithLineItemsRef.current = null
      startLoadTransition(async () => {
        try {
          const source = await loadInvoice(duplicateOfId)
          if (!source) {
            // Gone since the menu opened: say so and close, never leave a
            // blank "copy" that could be saved.
            toast({
              title: 'Unable to duplicate invoice',
              description: 'That invoice no longer exists.',
              variant: 'destructive',
            })
            onOpenChangeRef.current(false)
            return
          }
          loadedClientIdRef.current = source.company_id
          const defaults = buildInvoiceFormDefaults(source)
          form.reset({
            ...defaults,
            lineItems: defaults.lineItems.map(line => ({
              ...line,
              id: undefined,
            })),
          })
          form.clearErrors()
        } catch {
          toast({
            title: 'Unable to duplicate invoice',
            description: 'It may have been deleted. Try again from the list.',
            variant: 'destructive',
            link: toastLink('invoice', duplicateOfId),
          })
          onOpenChangeRef.current(false)
        }
      })
      return
    }

    if (!invoiceId) {
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

      // Mark the pre-filled client (if any) so auto-fill skips hydration
      loadedClientIdRef.current = prefillData?.companyId ?? null

      startResetTransition(() => {
        if (prefillData) {
          form.reset(prefillData)
          form.clearErrors()
        } else {
          const defaults = buildInvoiceFormDefaults(null)
          // Default the first line item to the first active catalog product
          const firstProduct = productCatalog[0]
          if (firstProduct) {
            defaults.lineItems = [createLineItemFromCatalog(firstProduct)]
          }
          form.reset(defaults)
          form.clearErrors()
        }
      })
      return
    }

    // Edit mode — fetch full invoice with line items.
    // React 19 async transitions keep the flag true until resolved.
    startLoadTransition(async () => {
      try {
        const fullInvoice = await loadInvoice(invoiceId)
        shownVersion.current = fullInvoice
          ? `${fullInvoice.id}:${fullInvoice.updated_at}`
          : null
        // Mark the loaded client so auto-fill skips hydration
        loadedClientIdRef.current = fullInvoice?.company_id ?? null
        invoiceWithLineItemsRef.current = fullInvoice
        resetFormState(fullInvoice)
      } catch {
        toast({
          title: 'Unable to load invoice',
          description: 'Close the sheet and open it again.',
          variant: 'destructive',
          link: toastLink('invoice', invoiceId),
        })
      }
    })
  }, [
    open,
    invoiceId,
    invoiceVersion,
    duplicateOfId,
    form,
    resetFormState,
    productCatalog,
    startLoadTransition,
    startResetTransition,
    toast,
  ])

  // ---------------------------------------------------------------------------
  // Auto-fill: due date + tax rate based on selected client
  // ---------------------------------------------------------------------------

  const watchedClientId = useWatch({ control: form.control, name: 'companyId' })

  // Build a map of state → tax rate for lookup
  const taxRateMap = useMemo(() => {
    const map = new Map<string, TaxRateData>()
    for (const tr of taxRates) {
      map.set(tr.state, tr)
    }
    return map
  }, [taxRates])

  useEffect(() => {
    if (!watchedClientId) return

    // Skip auto-fill when the client matches what was loaded (initial hydration)
    if (watchedClientId === loadedClientIdRef.current) return

    // Mark this client as the "current" so switching back won't re-trigger
    loadedClientIdRef.current = watchedClientId

    const selectedClient = clients.find(c => c.id === watchedClientId)
    if (!selectedClient) return

    // Auto-fill tax rate from client state
    if (selectedClient.state) {
      const matchingRate = taxRateMap.get(selectedClient.state)
      if (matchingRate) {
        const ratePercent = Number(matchingRate.rate) * 100
        form.setValue('taxRate', ratePercent, { shouldDirty: true })
      } else {
        form.setValue('taxRate', 0, { shouldDirty: true })
      }
    } else {
      form.setValue('taxRate', 0, { shouldDirty: true })
    }
  }, [watchedClientId, clients, taxRateMap, form])

  // Derive tax rate label for display
  const taxRateLabel = useMemo(() => {
    if (!watchedClientId) return null
    const selectedClient = clients.find(c => c.id === watchedClientId)
    if (!selectedClient?.state) return null
    const matchingRate = taxRateMap.get(selectedClient.state)
    if (!matchingRate) return null
    return matchingRate.label
  }, [watchedClientId, clients, taxRateMap])

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
    [form]
  )

  // ---------------------------------------------------------------------------
  // Sheet open/close
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const { stay, isReopening } = useSaveAndStay(
    'invoice',
    invoice?.id ?? null,
    open
  )

  const handleSubmit = useCallback(
    (values: InvoiceFormValues, mode: SheetSaveMode = 'close') => {
      if (readOnly) return

      startSave(async () => {
        form.clearErrors()

        const payload = createInvoiceSavePayload(
          values,
          invoiceWithLineItemsRef.current
        )

        const interaction = startSettingsInteraction({
          entity: 'invoice',
          mode: isEditing ? 'edit' : 'create',
          targetId: payload.id ?? null,
          metadata: {
            companyId: payload.companyId ?? null,
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
            toast({
              title: 'Unable to save invoice',
              description: result.error,
              variant: 'destructive',
              link: toastLink('invoice', payload.id),
            })
            return
          }

          finishSettingsInteraction(interaction, {
            status: 'success',
            targetId: payload.id ?? null,
          })

          toast({
            title: isEditing ? 'Invoice saved' : 'Invoice created',
            link: toastLink('invoice', result.id),
          })

          if (mode === 'stay' && isEditing && result.id) {
            // Reload before the save settles: new line items only get
            // their ids from the server, and a second save without them
            // would add those lines again.
            const fullInvoice = await loadInvoice(result.id).catch(() => null)
            if (fullInvoice) {
              shownVersion.current = `${fullInvoice.id}:${fullInvoice.updated_at}`
              invoiceWithLineItemsRef.current = fullInvoice
              loadedClientIdRef.current = fullInvoice.company_id ?? null
              resetFormState(fullInvoice)
              stay({ id: result.id, rebaseline: () => {} })
              return
            }
            // Saved, but the sheet can't show what was saved: close it
            // rather than risk saving the new lines twice.
            toast({
              title: 'Invoice saved, but it could not be reloaded',
              description: 'Open it again to keep editing.',
              link: toastLink('invoice', result.id),
            })
          } else if (mode === 'stay') {
            stay({ id: result.id, rebaseline: () => {} })
            return
          }

          resetFormState(null)
          onOpenChange(false)
          onComplete()
        } catch (error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          toast({
            title: 'Unable to save invoice',
            description:
              error instanceof Error ? error.message : 'Unknown error.',
            variant: 'destructive',
            link: toastLink('invoice', payload.id),
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
      startSave,
      stay,
      toast,
    ]
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
    startSave(async () => {
      form.clearErrors()

      const interaction = startSettingsInteraction({
        entity: 'invoice',
        mode: 'delete',
        targetId: invoice.id,
        metadata: {
          companyId: invoice.company_id ?? null,
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
          toast({
            title: 'Unable to archive invoice',
            description: result.error,
            variant: 'destructive',
            link: toastLink('invoice', invoice.id),
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
          link: toastLink('invoice', invoice.id, { archived: true }),
        })

        onOpenChange(false)
        onComplete()
      } catch (error) {
        finishSettingsInteraction(interaction, {
          status: 'error',
          targetId: invoice.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        toast({
          title: 'Unable to archive invoice',
          description:
            error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
          link: toastLink('invoice', invoice.id),
        })
      }
    })
  }, [form, invoice, isPending, onComplete, onOpenChange, startSave, toast])

  // ---------------------------------------------------------------------------
  // Line item helpers
  // ---------------------------------------------------------------------------

  const handleAddLineItem = useCallback(() => {
    fieldArray.append(createEmptyLineItem())
  }, [fieldArray])

  const keptLineItemCount = keptLineItems(watchedLineItems ?? []).length

  // Removing leaves the card as "Pending removal" until Save; Undo restores it.
  const setLineItemRemoved = useCallback(
    (index: number, removed: boolean) => {
      form.setValue(`lineItems.${index}.removed`, removed, {
        shouldDirty: true,
      })
      // Any errors on the line no longer apply while it is going.
      if (removed) form.clearErrors(`lineItems.${index}`)
    },
    [form]
  )

  const handleRemoveLineItem = useCallback(
    (index: number) => {
      if (keptLineItems(form.getValues('lineItems')).length <= 1) return
      setLineItemRemoved(index, true)
    },
    [form, setLineItemRemoved]
  )

  const handleRestoreLineItem = useCallback(
    (index: number) => setLineItemRemoved(index, false),
    [setLineItemRemoved]
  )

  const handleMoveLineItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      fieldArray.move(fromIndex, toIndex)
    },
    [fieldArray]
  )

  const handleProductSelect = useCallback(
    (index: number, productId: string) => {
      // "custom" clears the catalog link and resets fields for manual entry
      if (productId === '__custom__') {
        form.setValue(`lineItems.${index}.productCatalogItemId`, null, {
          shouldDirty: true,
        })
        form.setValue(`lineItems.${index}.description`, '', {
          shouldDirty: true,
        })
        form.setValue(`lineItems.${index}.unitPrice`, 0, {
          shouldDirty: true,
        })
        form.setValue(`lineItems.${index}.createsHourBlock`, false, {
          shouldDirty: true,
        })
        return
      }

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
        { shouldDirty: true }
      )
      form.setValue(
        `lineItems.${index}.createsHourBlock`,
        product.creates_hour_block_default,
        { shouldDirty: true }
      )
    },
    [form, productCatalog]
  )

  // ---------------------------------------------------------------------------
  // Derived field states
  // ---------------------------------------------------------------------------

  // Fields lock for either reason — a form that's still loading its line
  // items shouldn't be editable any more than one mid-save.
  const isBusy = isPending || isLoading

  const clientField: FieldState = useMemo(
    () => deriveClientFieldState(isBusy, clientOptions, invoiceStatus),
    [clientOptions, invoiceStatus, isBusy]
  )

  const standardField: FieldState = useMemo(
    () => deriveStandardFieldState(isBusy, invoiceStatus),
    [invoiceStatus, isBusy]
  )

  const submitButton: SubmitButtonState = useMemo(
    () =>
      deriveSubmitButtonState(
        isPending || isReopening,
        isEditing,
        clientOptions,
        invoiceStatus,
        isBusy || isReopening
      ),
    [clientOptions, invoiceStatus, isEditing, isPending, isBusy, isReopening]
  )

  const deleteButton: DeleteButtonState = useMemo(
    () => deriveDeleteButtonState(isEditing, isPending, invoice),
    [invoice, isEditing, isPending]
  )

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    form,
    fieldArray,
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
    confirmDiscard,
    totals,
    taxRateLabel,
    handleSheetOpenChange,
    handleSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleAddLineItem,
    handleRemoveLineItem,
    handleRestoreLineItem,
    keptLineItemCount,
    handleMoveLineItem,
    handleProductSelect,
  }
}
