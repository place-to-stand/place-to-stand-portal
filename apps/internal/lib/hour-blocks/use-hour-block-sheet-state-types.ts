import type { UseFormReturn } from 'react-hook-form'

import type { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'

import type {
  HourBlockClient,
  HourBlockFormValues,
  HourBlockWithClient,
} from './hour-block-form'
import type { ClientOption } from './hour-block-options'
import type {
  DeleteButtonState,
  FieldState,
  SubmitButtonState,
} from './hour-block-ui-state'

export type UseHourBlockSheetStateArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  hourBlock: HourBlockWithClient | null
  /** Create a new hour block filled in from this one (Duplicate). */
  duplicateOf?: HourBlockWithClient | null
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
