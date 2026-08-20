'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  useForm,
  useWatch,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  saveHourBlock,
  softDeleteHourBlock,
} from '@/app/(dashboard)/hour-blocks/actions'
import { useToast } from '@/components/ui/use-toast'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { useSheetLifecycle } from '@/lib/sheets/use-sheet-lifecycle'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'
import {
  buildHourBlockFormDefaults,
  createHourBlockSavePayload,
  hourBlockFormSchema,
  HOUR_BLOCK_FORM_FIELDS,
  sortClientsByName,
  type ClientRow,
  type HourBlockFormValues,
  type HourBlockInvoiceRow,
  type HourBlockWithClient,
} from './hour-block-form'
export type { HourBlockFormValues } from './hour-block-form'
import {
  buildClientOptions,
  buildInvoiceOptions,
  type ClientOption,
  type InvoiceOption,
} from './hour-block-options'
import {
  deriveClientFieldState,
  deriveDeleteButtonState,
  deriveStandardFieldState,
  deriveSubmitButtonState,
  type DeleteButtonState,
  type FieldState,
  type SubmitButtonState,
} from './hour-block-ui-state'

export type UseHourBlockSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  hourBlock: HourBlockWithClient | null
  clients: ClientRow[]
  invoices: HourBlockInvoiceRow[]
}

export type UseHourBlockSheetStateReturn = {
  form: UseFormReturn<HourBlockFormValues>
  feedback: string | null
  isEditing: boolean
  isPending: boolean
  clientOptions: ClientOption[]
  invoiceOptions: InvoiceOption[]
  /** Set when the selected invoice was issued to a different client. */
  invoiceHint: string | null
  clientField: FieldState
  hoursField: FieldState
  invoiceField: FieldState
  submitButton: SubmitButtonState
  deleteButton: DeleteButtonState
  isDeleteDialogOpen: boolean
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  handleSheetOpenChange: (open: boolean) => void
  handleSubmit: (values: HourBlockFormValues) => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
  setFeedback: (value: string | null) => void
}

export function useHourBlockSheetState({
  open,
  onOpenChange,
  onComplete,
  hourBlock,
  clients,
  invoices,
}: UseHourBlockSheetStateArgs): UseHourBlockSheetStateReturn {
  const isEditing = Boolean(hourBlock)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { toast } = useToast()

  const sortedClients = useMemo(() => sortClientsByName(clients), [clients])

  const clientOptions = useMemo<ClientOption[]>(
    () => buildClientOptions(sortedClients),
    [sortedClients]
  )

  const resolver = zodResolver(
    hourBlockFormSchema
  ) as Resolver<HourBlockFormValues>

  const form = useForm<HourBlockFormValues>({
    resolver,
    defaultValues: buildHourBlockFormDefaults(hourBlock),
  })

  const selectedClientId = useWatch({
    control: form.control,
    name: 'clientId',
  })

  const invoiceOptions = useMemo<InvoiceOption[]>(() => {
    // An invoice that dropped out of the directory (e.g. archived after the
    // link was made) still needs to render on the existing block, so append
    // it from the block's own denormalized number.
    const directory =
      hourBlock?.invoice_id &&
      hourBlock.invoice_number &&
      !invoices.some(invoice => invoice.id === hourBlock.invoice_id)
        ? [
            ...invoices,
            {
              id: hourBlock.invoice_id,
              invoice_number: hourBlock.invoice_number,
              client_id: hourBlock.client_id,
              client_name: hourBlock.client?.name ?? null,
              status: 'ARCHIVED',
              total: 0,
              issued_date: null,
            },
          ]
        : invoices

    return buildInvoiceOptions(
      directory,
      selectedClientId || null,
      hourBlock?.invoice_id ?? null
    )
  }, [hourBlock, invoices, selectedClientId])

  const selectedInvoiceId = useWatch({
    control: form.control,
    name: 'invoiceId',
  })

  // Cross-client links stay valid (hours transferred between clients keep
  // the original purchase invoice) — but surface that it's intentional.
  const invoiceHint = useMemo(() => {
    if (!selectedInvoiceId || !selectedClientId) {
      return null
    }

    const invoice = invoices.find(row => row.id === selectedInvoiceId)
    const ownerClientId = invoice?.client_id ?? hourBlock?.client_id ?? null
    const ownerName = invoice?.client_name ?? hourBlock?.client?.name ?? null

    if (!ownerClientId || ownerClientId === selectedClientId) {
      return null
    }

    return `This invoice was issued to ${ownerName ?? 'another client'} — keeping it preserves the original purchase record.`
  }, [hourBlock, invoices, selectedClientId, selectedInvoiceId])

  const resetFormState = useCallback(() => {
    form.reset(buildHourBlockFormDefaults(hourBlock))
    form.clearErrors()
    setFeedback(null)
  }, [form, hourBlock])

  const {
    isSaving: isPending,
    startSave,
    handleSheetOpenChange,
    unsavedChangesDialog,
  } = useSheetLifecycle({
    open,
    onOpenChange,
    isDirty: form.formState.isDirty,
    onReset: resetFormState,
    resetKey: hourBlock?.id ?? null,
  })

  const applyServerFieldErrors = useCallback(
    (fieldErrors?: Record<string, string[]>) => {
      if (!fieldErrors) return

      HOUR_BLOCK_FORM_FIELDS.forEach(field => {
        const message = fieldErrors[field]?.[0]
        if (!message) return
        form.setError(field, { type: 'server', message })
      })
    },
    [form]
  )

  const handleSubmit = useCallback(
    (values: HourBlockFormValues) => {
      startSave(async () => {
        setFeedback(null)
        form.clearErrors()

        const payload = createHourBlockSavePayload(values, hourBlock)

        const interaction = startSettingsInteraction({
          entity: 'hour_block',
          mode: isEditing ? 'edit' : 'create',
          targetId: payload.id ?? null,
          metadata: {
            clientId: payload.clientId ?? null,
          },
        })

        try {
          const result = await saveHourBlock(payload)

          applyServerFieldErrors(result.fieldErrors)

          if (result.error) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              error: result.error,
            })
            setFeedback(result.error)
            toast({
              title: 'Unable to save hour block',
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
            title: isEditing ? 'Hour block updated' : 'Hour block created',
            description: isEditing
              ? 'Changes saved successfully.'
              : 'The hour block is ready for tracking.',
          })

          // PRD 002 section 05: closed-month / future-billing notice.
          if (result.warning) {
            toast({
              title: 'Heads up',
              description: result.warning,
            })
          }

          resetFormState()
          onOpenChange(false)
          onComplete()
        } catch (error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          setFeedback('We could not save this hour block. Please try again.')
          toast({
            title: 'Unable to save hour block',
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
      hourBlock,
      isEditing,
      onComplete,
      onOpenChange,
      resetFormState,
      startSave,
      toast,
    ]
  )

  const handleRequestDelete = useCallback(() => {
    if (!hourBlock || hourBlock.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(true)
  }, [hourBlock, isPending])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
  }, [isPending])

  const handleConfirmDelete = useCallback(() => {
    if (!hourBlock || hourBlock.deleted_at || isPending) {
      return
    }

    setIsDeleteDialogOpen(false)
    startSave(async () => {
      setFeedback(null)
      form.clearErrors()
      const interaction = startSettingsInteraction({
        entity: 'hour_block',
        mode: 'delete',
        targetId: hourBlock.id,
        metadata: {
          clientId: hourBlock.client?.id ?? null,
        },
      })

      try {
        const result = await softDeleteHourBlock({ id: hourBlock.id })

        if (result.error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            targetId: hourBlock.id,
            error: result.error,
          })
          setFeedback(result.error)
          toast({
            title: 'Unable to delete hour block',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        finishSettingsInteraction(interaction, {
          status: 'success',
          targetId: hourBlock.id,
        })

        toast({
          title: 'Hour block archived',
          description:
            'It will be hidden from active tracking but remains available historically.',
        })
        if (result.warning) {
          toast({ title: 'Heads up', description: result.warning })
        }

        onOpenChange(false)
        onComplete()
      } catch (error) {
        finishSettingsInteraction(interaction, {
          status: 'error',
          targetId: hourBlock.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        setFeedback('We could not delete this hour block. Please try again.')
        toast({
          title: 'Unable to delete hour block',
          description:
            error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        })
      }
    })
  }, [
    form,
    hourBlock,
    isPending,
    onComplete,
    onOpenChange,
    startSave,
    toast,
  ])

  const clientField: FieldState = useMemo(
    () => deriveClientFieldState(isPending, clientOptions),
    [clientOptions, isPending]
  )

  const hoursField: FieldState = useMemo(
    () => deriveStandardFieldState(isPending),
    [isPending]
  )

  const invoiceField = hoursField

  const submitButton: SubmitButtonState = useMemo(
    () => deriveSubmitButtonState(isPending, isEditing, clientOptions),
    [clientOptions, isEditing, isPending]
  )

  const deleteButton: DeleteButtonState = useMemo(
    () => deriveDeleteButtonState(isEditing, isPending, hourBlock),
    [hourBlock, isEditing, isPending]
  )

  return {
    form,
    feedback,
    isEditing,
    isPending,
    clientOptions,
    invoiceOptions,
    invoiceHint,
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
    setFeedback,
  }
}
