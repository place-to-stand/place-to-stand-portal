'use client'

import { useCallback, useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { saveHourBlock } from '@/app/(dashboard)/hour-blocks/actions'
import { toastLink, useToast } from '@/components/ui/use-toast'
import type { SheetSaveMode } from '@/lib/sheets/save-mode'
import { useReloadSheetRecord } from '@/lib/sheets/use-reload-sheet-record'
import { useSaveAndStay } from '@/lib/sheets/use-save-and-stay'
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
  type HourBlockFormValues,
} from './hour-block-form'
export type { HourBlockFormValues } from './hour-block-form'
import { archiveHourBlockFromSheet } from './hour-block-archive-flow'
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
import type {
  UseHourBlockSheetStateArgs,
  UseHourBlockSheetStateReturn,
} from './use-hour-block-sheet-state-types'

export type {
  UseHourBlockSheetStateArgs,
  UseHourBlockSheetStateReturn,
} from './use-hour-block-sheet-state-types'

export function useHourBlockSheetState({
  open,
  onOpenChange,
  onComplete,
  hourBlock,
  duplicateOf = null,
  clients,
}: UseHourBlockSheetStateArgs): UseHourBlockSheetStateReturn {
  const isEditing = Boolean(hourBlock)
  const source = hourBlock ?? duplicateOf // A copy starts from its source.
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
    defaultValues: buildHourBlockFormDefaults(source),
  })

  const resetFormState = useCallback(() => {
    form.reset(buildHourBlockFormDefaults(source))
    form.clearErrors()
  }, [form, source])

  const {
    isSaving: isPending,
    startSave,
    handleSheetOpenChange,
    unsavedChangesDialog,
    confirmDiscard,
    saveConflict,
  } = useSheetLifecycle({
    open,
    onOpenChange,
    isDirty: form.formState.isDirty,
    onReset: resetFormState,
    resetKey: hourBlock?.id ?? (duplicateOf && `copy-${duplicateOf.id}`),
    version: hourBlock?.updated_at ?? null,
  })
  const reloadRecord = useReloadSheetRecord('hour-block', hourBlock?.id ?? null)
  // Drop the edits; the lifecycle re-seeds when the newer block lands.
  const handleLoadTheirs = useCallback(() => {
    resetFormState()
    reloadRecord()
  }, [reloadRecord, resetFormState])

  const { stay, isReopening } = useSaveAndStay(
    'hour-block',
    hourBlock?.id ?? null,
    open
  )

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
    (values: HourBlockFormValues, mode: SheetSaveMode = 'close') => {
      startSave(async () => {
        form.clearErrors()

        const payload = {
          ...createHourBlockSavePayload(values, hourBlock),
          expectedUpdatedAt: hourBlock ? saveConflict.expected() : undefined,
        }

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

          if (saveConflict.catchConflict(result, mode)) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              error: result.error ?? 'conflict',
            })
            return
          }
          if (result.error) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              error: result.error,
            })
            toast({
              title: 'Unable to save hour block',
              description: result.error,
              variant: 'destructive',
              link: toastLink('hour-block', payload.id),
            })
            return
          }

          saveConflict.saved(result.updatedAt)
          finishSettingsInteraction(interaction, {
            status: 'success',
            targetId: payload.id ?? null,
          })

          // Keep open: no toast; stay() makes its Save button say "Saved".
          if (mode === 'close') {
            toast({
              title: isEditing ? 'Hour block saved' : 'Hour block created',
              link: toastLink('hour-block', result.id),
            })
          }

          // PRD 002 section 05: closed-month / future-billing notice.
          if (result.warning) {
            toast({
              title: 'Review billing details',
              description: result.warning,
              link: toastLink('hour-block', result.id),
            })
          }

          if (mode === 'stay') {
            stay({ id: result.id, rebaseline: () => form.reset(values) })
            return
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
            link: toastLink('hour-block', payload.id),
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
      saveConflict,
      startSave,
      stay,
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
      if (await archiveHourBlockFromSheet(hourBlock, toast)) {
        onOpenChange(false)
        onComplete()
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
    () =>
      deriveSubmitButtonState(
        isPending || isReopening,
        isEditing,
        clientOptions
      ),
    [clientOptions, isEditing, isPending, isReopening]
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
    confirmDiscard,
    saveConflict,
    handleLoadTheirs,
    handleSheetOpenChange,
    handleSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
  }
}
