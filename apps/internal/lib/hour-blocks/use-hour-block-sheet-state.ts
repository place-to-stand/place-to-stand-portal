'use client'

import { useCallback, useMemo, useState } from 'react'
import { useForm, type Resolver, type UseFormReturn } from 'react-hook-form'
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
  type HourBlockClient,
  type HourBlockFormValues,
  type HourBlockWithClient,
} from './hour-block-form'
export type { HourBlockFormValues } from './hour-block-form'
import { buildClientOptions, type ClientOption } from './hour-block-options'
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
  clients: HourBlockClient[]
}

export type UseHourBlockSheetStateReturn = {
  form: UseFormReturn<HourBlockFormValues>
  isEditing: boolean
  isPending: boolean
  clientOptions: ClientOption[]
  clientField: FieldState
  hoursField: FieldState
  notesField: FieldState
  submitButton: SubmitButtonState
  deleteButton: DeleteButtonState
  isDeleteDialogOpen: boolean
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  handleSheetOpenChange: (open: boolean) => void
  handleSubmit: (values: HourBlockFormValues) => void
  handleRequestDelete: () => void
  handleCancelDelete: () => void
  handleConfirmDelete: () => void
}

export function useHourBlockSheetState({
  open,
  onOpenChange,
  onComplete,
  hourBlock,
  clients,
}: UseHourBlockSheetStateArgs): UseHourBlockSheetStateReturn {
  const isEditing = Boolean(hourBlock)
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

  const resetFormState = useCallback(() => {
    form.reset(buildHourBlockFormDefaults(hourBlock))
    form.clearErrors()
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
        form.clearErrors()

        const payload = createHourBlockSavePayload(values, hourBlock)

        const interaction = startSettingsInteraction({
          entity: 'hour_block',
          mode: isEditing ? 'edit' : 'create',
          targetId: payload.id ?? null,
          metadata: {
            companyId: payload.companyId ?? null,
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
            title: isEditing ? 'Hour block saved' : 'Hour block created',
          })

          // PRD 002 section 05: closed-month / future-billing notice.
          if (result.warning) {
            toast({
              title: 'Review billing details',
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
      form.clearErrors()
      const interaction = startSettingsInteraction({
        entity: 'hour_block',
        mode: 'delete',
        targetId: hourBlock.id,
        metadata: {
          companyId: hourBlock.client?.id ?? null,
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
          toast({
            title: 'Unable to archive hour block',
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
          toast({
            title: 'Closed month affected',
            description: result.warning,
            variant: 'warning',
          })
        }

        onOpenChange(false)
        onComplete()
      } catch (error) {
        finishSettingsInteraction(interaction, {
          status: 'error',
          targetId: hourBlock.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        toast({
          title: 'Unable to archive hour block',
          description:
            error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        })
      }
    })
  }, [form, hourBlock, isPending, onComplete, onOpenChange, startSave, toast])

  const clientField: FieldState = useMemo(
    () => deriveClientFieldState(isPending, clientOptions),
    [clientOptions, isPending]
  )

  const hoursField: FieldState = useMemo(
    () => deriveStandardFieldState(isPending),
    [isPending]
  )

  const notesField = hoursField

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
    isEditing,
    isPending,
    clientOptions,
    clientField,
    hoursField,
    notesField,
    submitButton,
    deleteButton,
    isDeleteDialogOpen,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  }
}
