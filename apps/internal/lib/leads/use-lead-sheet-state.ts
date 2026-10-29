'use client'

import {
  useCallback,
  useRef,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'

import { useToast } from '@/components/ui/use-toast'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { roleCan } from '@/lib/auth/capabilities'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { archiveLead, saveLead } from '@/app/(dashboard)/leads/actions'
import { getSubmitLabel } from '@/lib/forms/form-controls'
import {
  leadFormSchema,
  type LeadFormValues,
  type LeadSheetProps,
} from '@/app/(dashboard)/leads/_components/lead-sheet/types'

export function useLeadSheetState({
  open,
  onOpenChange,
  lead,
  initialStatus,
  initialAction = null,
  onSuccess,
  onCreated,
  initialValues,
}: Omit<LeadSheetProps, 'assignees' | 'canManage'>) {
  const isEditing = Boolean(lead)
  const [isSaving, startSaveTransition] = useTransition()
  const [isArchiving, startArchiveTransition] = useTransition()
  const hasInitialAction = Boolean(lead && initialAction)
  const [isArchiveDialogOpen, setArchiveDialogOpen] = useState(false)
  // Converting creates a client, so it's admin-only (`leads.convert`).
  const { role } = useViewerAccess()
  const canConvert =
    roleCan(role, 'leads.convert') &&
    lead?.status === 'CLOSED_WON' &&
    !lead?.convertedToClientId
  const [isConvertDialogOpen, setConvertDialogOpen] = useState(
    () => hasInitialAction && initialAction === 'convert' && canConvert
  )
  const { toast } = useToast()

  const { setAux } = useSheetParams()

  // Mirrors the convert dialog's open state into `?leadMode=convert` so the
  // sub-state is shareable, via the router (replace) rather than raw history
  // mutation — the Next router cache stays in sync with the URL.
  const setActionParam = useCallback(
    (action: string | null) => {
      if (!lead) return
      setAux('leadMode', action)
    },
    [lead, setAux]
  )

  const defaultValues = useMemo<LeadFormValues>(
    () => ({
      contact: lead?.contactId
        ? {
            id: lead.contactId,
            name: lead.contactName,
            email: lead.contactEmail ?? null,
            phone: lead.contactPhone ?? null,
          }
        : null,
      company: lead?.companyId
        ? { id: lead.companyId, name: lead.companyName ?? '' }
        : null,
      sourceType: lead?.sourceType ?? null,
      sourceDetail: lead?.sourceDetail ?? '',
      status: lead?.status ?? initialStatus ?? 'NEW_OPPORTUNITIES',
      assigneeId: lead?.assigneeId ?? null,
      notes: lead?.notesHtml ?? initialValues?.notes ?? '',
    }),
    [lead, initialStatus, initialValues]
  )

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues,
  })

  // Reset only when a different record (or a newer save of it) arrives. A
  // router refresh hands over a fresh but identical `lead` object, e.g. after
  // a sheet stacked on top saves, and must not wipe unsaved edits such as a
  // company just picked from that sheet.
  const resetKey = lead
    ? `${lead.id}:${lead.updatedAt}`
    : `new:${initialStatus ?? ''}`
  const lastResetKey = useRef<string | null>(null)
  useEffect(() => {
    // Closing forgets the key, so reopening always starts from the record.
    if (!open) {
      lastResetKey.current = null
      return
    }
    if (lastResetKey.current === resetKey) return
    lastResetKey.current = resetKey
    form.reset(defaultValues)
  }, [defaultValues, form, open, resetKey])

  const selectedSourceType = useWatch({
    control: form.control,
    name: 'sourceType',
  })

  useEffect(() => {
    if (!selectedSourceType) {
      const currentDetail = form.getValues('sourceDetail')
      if (currentDetail) {
        form.setValue('sourceDetail', '')
      }
    }
  }, [form, selectedSourceType])

  const submitDisabled = isSaving || isArchiving
  const historyKey = lead?.id ?? 'lead:new'

  const handleFormSubmit = useCallback(
    (values: LeadFormValues) => {
      startSaveTransition(async () => {
        const { company, contact, ...fields } = values
        const result = await saveLead({
          id: lead?.id,
          ...fields,
          // The server copies the contact's details onto the lead.
          contactId: contact?.id,
          contactName: contact?.name ?? '',
          contactEmail: contact?.email ?? null,
          contactPhone: contact?.phone ?? null,
          companyId: company?.id ?? null,
          companyName: company?.name ?? null,
        })

        if (!result.success) {
          toast({
            variant: 'destructive',
            title: 'Unable to save lead',
            description: result.error ?? 'Please try again.',
          })
          return
        }

        toast({
          title: isEditing ? 'Lead updated' : 'Lead created',
          description: isEditing
            ? 'Changes saved.'
            : 'Your new lead has been added to the pipeline.',
        })

        form.reset({
          ...values,
          contact: values.contact ?? null,
          company: values.company ?? null,
          sourceType: values.sourceType ?? null,
          sourceDetail: values.sourceDetail ?? '',
          status: values.status,
          assigneeId: values.assigneeId ?? null,
          notes: values.notes ?? '',
        })

        setArchiveDialogOpen(false)
        onOpenChange(false)
        onSuccess()
        if (!isEditing && result.leadId) {
          onCreated?.(result.leadId)
        }
      })
    },
    [form, isEditing, lead?.id, onOpenChange, onSuccess, onCreated, toast]
  )

  const handleSaveShortcut = useCallback(
    () => form.handleSubmit(handleFormSubmit)(),
    [form, handleFormSubmit]
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls<LeadFormValues>(
    {
      form,
      isActive: open,
      canSave: !submitDisabled,
      onSave: handleSaveShortcut,
      historyKey,
    }
  )

  const saveLabel = useMemo(
    () => getSubmitLabel({ isSaving, isEditing, createLabel: 'Create lead' }),
    [isEditing, isSaving]
  )

  const submitDisabledReason = isSaving
    ? 'Saving lead...'
    : isArchiving
      ? 'Archiving lead...'
      : null

  const archiveDisabledReason = isSaving
    ? 'Finish saving before archiving.'
    : isArchiving
      ? 'Archiving lead...'
      : null

  const handleArchive = useCallback(() => {
    if (!lead) return

    startArchiveTransition(async () => {
      const result = await archiveLead({ leadId: lead.id })

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to archive lead',
          description: result.error ?? 'Please try again.',
        })
        return
      }

      toast({
        title: 'Lead archived',
        description: 'The lead has been archived and removed from the board.',
      })

      setArchiveDialogOpen(false)
      onOpenChange(false)
      onSuccess()
    })
  }, [lead, onOpenChange, onSuccess, toast])

  const {
    requestConfirmation: requestCloseConfirmation,
    dialog: unsavedChangesDialog,
  } = useUnsavedChangesWarning({
    isDirty: form.formState.isDirty,
    title: 'Discard lead changes?',
    description:
      'You have unsaved updates for this lead. Continue without saving?',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
  })

  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true)
        return
      }

      requestCloseConfirmation(() => {
        setArchiveDialogOpen(false)
        onOpenChange(false)
      })
    },
    [onOpenChange, requestCloseConfirmation]
  )

  return {
    form,
    isEditing,
    isSaving,
    isArchiving,
    isArchiveDialogOpen,
    setArchiveDialogOpen,
    isConvertDialogOpen,
    setConvertDialogOpen,
    setActionParam,
    canConvert,
    selectedSourceType,
    submitDisabled,
    submitDisabledReason,
    archiveDisabledReason,
    saveLabel,
    undo,
    redo,
    canUndo,
    canRedo,
    unsavedChangesDialog,
    handleFormSubmit,
    handleArchive,
    handleSheetOpenChange,
  }
}
