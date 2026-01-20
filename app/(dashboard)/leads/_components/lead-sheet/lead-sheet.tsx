'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'

import { TaskSheetFormFooter } from '@/app/(dashboard)/projects/_components/task-sheet/form/task-sheet-form-footer'
import { Form } from '@/components/ui/form'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'

import { archiveLead, saveLead } from '../../actions'
import { LeadMeetingsSection } from '../lead-meetings-section'
import { LeadProposalsSection } from '../lead-proposals-section'
import { LeadSuggestionsPanel } from '../lead-suggestions-panel'
import { LeadSheetDialogs } from './lead-sheet-dialogs'
import { LeadSheetFormFields } from './lead-sheet-form-fields'
import { LeadSheetHeader } from './lead-sheet-header'
import { leadFormSchema, type LeadFormValues, type LeadSheetProps } from './types'

export function LeadSheet({
  open,
  onOpenChange,
  lead,
  initialStatus,
  assignees,
  canManage = false,
  senderName = '',
  onSuccess,
}: LeadSheetProps) {
  const isEditing = Boolean(lead)
  const [isSaving, startSaveTransition] = useTransition()
  const [isArchiving, startArchiveTransition] = useTransition()
  const [isArchiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [isConvertDialogOpen, setConvertDialogOpen] = useState(false)
  const [isEmailDialogOpen, setEmailDialogOpen] = useState(false)
  const [isMeetingDialogOpen, setMeetingDialogOpen] = useState(false)
  const [meetingInitialTitle, setMeetingInitialTitle] = useState<string | undefined>()
  const [isProposalDialogOpen, setProposalDialogOpen] = useState(false)
  const { toast } = useToast()

  const canConvert = lead?.status === 'CLOSED_WON' && !lead?.convertedToClientId
  const isConverted = Boolean(lead?.convertedToClientId)

  const defaultValues = useMemo<LeadFormValues>(
    () => ({
      contactName: lead?.contactName ?? '',
      contactEmail: lead?.contactEmail ?? '',
      contactPhone: lead?.contactPhone ?? '',
      companyName: lead?.companyName ?? '',
      companyWebsite: lead?.companyWebsite ?? '',
      sourceType: lead?.sourceType ?? null,
      sourceDetail: lead?.sourceDetail ?? '',
      status: lead?.status ?? initialStatus ?? 'NEW_OPPORTUNITIES',
      assigneeId: lead?.assigneeId ?? null,
      notes: lead?.notesHtml ?? '',
      priorityTier: lead?.priorityTier ?? null,
    }),
    [lead, initialStatus]
  )

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

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
        const result = await saveLead({
          id: lead?.id,
          ...values,
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
            ? 'The lead has been updated successfully.'
            : 'Your new lead has been added to the pipeline.',
        })

        form.reset({
          ...values,
          contactName: values.contactName ?? '',
          contactEmail: values.contactEmail ?? '',
          contactPhone: values.contactPhone ?? '',
          companyName: values.companyName ?? '',
          companyWebsite: values.companyWebsite ?? '',
          sourceType: values.sourceType ?? null,
          sourceDetail: values.sourceDetail ?? '',
          status: values.status,
          assigneeId: values.assigneeId ?? null,
          notes: values.notes ?? '',
          priorityTier: values.priorityTier ?? null,
        })

        setArchiveDialogOpen(false)
        onOpenChange(false)
        onSuccess()
      })
    },
    [form, isEditing, lead?.id, onOpenChange, onSuccess, toast]
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

  const saveLabel = useMemo(() => {
    if (isSaving) {
      return isEditing ? 'Saving...' : 'Creating...'
    }
    return isEditing ? 'Save changes' : 'Create lead'
  }, [isEditing, isSaving])

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

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto pb-24 sm:max-w-[676px]'>
          <div className='flex flex-col gap-6'>
            <SheetHeader className='border-b-2 border-b-amber-500/60 px-6 pt-4'>
              <SheetTitle>{isEditing ? 'Edit lead' : 'New lead'}</SheetTitle>
              <SheetDescription>
                {isEditing
                  ? 'Keep this lead up to date so the pipeline stays accurate.'
                  : 'Capture lead context, assignees, and next steps to keep deals moving.'}
              </SheetDescription>
            </SheetHeader>

            {isEditing && lead && (
              <LeadSheetHeader
                lead={lead}
                canManage={canManage}
                canConvert={canConvert}
                isConverted={isConverted}
                onSendEmail={() => setEmailDialogOpen(true)}
                onConvertToClient={() => setConvertDialogOpen(true)}
              />
            )}

            <Form {...form}>
              <form
                className='flex flex-1 flex-col gap-6 px-6 pb-4'
                onSubmit={form.handleSubmit(handleFormSubmit)}
              >
                <LeadSheetFormFields
                  control={form.control}
                  assignees={assignees}
                  selectedSourceType={selectedSourceType}
                />

                {isEditing && lead && canManage && (
                  <div className='rounded-lg border bg-muted/30 p-4'>
                    <LeadSuggestionsPanel
                      leadId={lead.id}
                      isAdmin={canManage}
                      onScheduleCall={(initialTitle) => {
                        setMeetingInitialTitle(initialTitle)
                        setMeetingDialogOpen(true)
                      }}
                      onSendProposal={() => setProposalDialogOpen(true)}
                    />
                  </div>
                )}

                {isEditing && lead && (
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <div className='rounded-lg border bg-muted/30 p-4'>
                      <LeadMeetingsSection
                        lead={lead}
                        canManage={canManage}
                        onSuccess={onSuccess}
                      />
                    </div>
                    <div className='rounded-lg border bg-muted/30 p-4'>
                      <LeadProposalsSection
                        lead={lead}
                        canManage={canManage}
                        onSuccess={onSuccess}
                      />
                    </div>
                  </div>
                )}

                <TaskSheetFormFooter
                  saveLabel={saveLabel}
                  submitDisabled={submitDisabled}
                  submitDisabledReason={submitDisabledReason}
                  undo={undo}
                  redo={redo}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  isEditing={isEditing}
                  deleteDisabled={submitDisabled}
                  deleteDisabledReason={archiveDisabledReason}
                  onRequestDelete={() => setArchiveDialogOpen(true)}
                  deleteAriaLabel='Archive lead'
                />
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>
      <LeadSheetDialogs
        lead={lead}
        senderName={senderName}
        isArchiveDialogOpen={isArchiveDialogOpen}
        isArchiving={isArchiving}
        onArchiveCancel={() => {
          if (!isArchiving) {
            setArchiveDialogOpen(false)
          }
        }}
        onArchiveConfirm={handleArchive}
        isConvertDialogOpen={isConvertDialogOpen}
        onConvertOpenChange={setConvertDialogOpen}
        isEmailDialogOpen={isEmailDialogOpen}
        onEmailOpenChange={setEmailDialogOpen}
        isMeetingDialogOpen={isMeetingDialogOpen}
        meetingInitialTitle={meetingInitialTitle}
        onMeetingOpenChange={setMeetingDialogOpen}
        onMeetingSuccess={() => {
          setMeetingDialogOpen(false)
          setMeetingInitialTitle(undefined)
          onSuccess()
        }}
        isProposalDialogOpen={isProposalDialogOpen}
        onProposalOpenChange={setProposalDialogOpen}
        onProposalSuccess={() => {
          setProposalDialogOpen(false)
          onSuccess()
        }}
        onSuccess={onSuccess}
        unsavedChangesDialog={unsavedChangesDialog}
      />
    </>
  )
}
