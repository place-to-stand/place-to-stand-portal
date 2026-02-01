'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Archive, Redo2, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
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

import { archiveLead, saveLead, rescoreLead } from '../../actions'
import { LeadSheetDialogs } from './lead-sheet-dialogs'
import { LeadSheetFormFields } from './lead-sheet-form-fields'
import { LeadSheetHeader } from './lead-sheet-header'
import { LeadSheetRightColumn } from './lead-sheet-right-column'
import { leadFormSchema, type LeadFormValues, type LeadSheetProps } from './types'

export function LeadSheet({
  open,
  onOpenChange,
  lead,
  initialStatus,
  initialAction = null,
  assignees,
  canManage = false,
  senderName = '',
  onSuccess,
}: LeadSheetProps) {
  const router = useRouter()
  const isEditing = Boolean(lead)
  const [isSaving, startSaveTransition] = useTransition()
  const [isArchiving, startArchiveTransition] = useTransition()
  const [isRescoring, startRescoreTransition] = useTransition()
  const [isArchiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [isConvertDialogOpen, setConvertDialogOpen] = useState(false)
  const [isEmailDialogOpen, setEmailDialogOpen] = useState(false)
  const [isMeetingDialogOpen, setMeetingDialogOpen] = useState(false)
  const [meetingInitialTitle, setMeetingInitialTitle] = useState<string | undefined>()
  const [isBuildProposalDialogOpen, setBuildProposalDialogOpen] = useState(false)
  const { toast } = useToast()

  // Track whether we've already consumed the initial action to avoid re-opening on re-renders
  const consumedActionRef = useRef<string | null>(null)

  // Open the matching dialog when initialAction is set (e.g. deep link)
  useEffect(() => {
    if (!initialAction || !lead || consumedActionRef.current === initialAction) return
    consumedActionRef.current = initialAction

    switch (initialAction) {
      case 'proposals/new':
        setBuildProposalDialogOpen(true)
        break
      case 'email':
        setEmailDialogOpen(true)
        break
      case 'meeting':
        setMeetingDialogOpen(true)
        break
      case 'convert':
        setConvertDialogOpen(true)
        break
    }
  }, [initialAction, lead])

  const pushActionUrl = useCallback(
    (action: string) => {
      if (!lead) return
      router.push(`/leads/board/${lead.id}/${action}`, { scroll: false })
    },
    [lead, router]
  )

  const pushLeadUrl = useCallback(() => {
    if (!lead) return
    router.push(`/leads/board/${lead.id}`, { scroll: false })
  }, [lead, router])

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

  const handleRescore = useCallback(() => {
    if (!lead) return

    startRescoreTransition(async () => {
      const result = await rescoreLead({ leadId: lead.id })

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to rescore lead',
          description: result.error ?? 'Please try again.',
        })
        return
      }

      toast({
        title: 'Lead rescored',
        description: 'The lead has been analyzed and rescored.',
      })

      onSuccess()
    })
  }, [lead, onSuccess, toast])

  const handleScheduleMeeting = useCallback((initialTitle?: string) => {
    setMeetingInitialTitle(initialTitle)
    setMeetingDialogOpen(true)
  }, [])

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
        <SheetContent className='flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-6xl'>
          {/* Header */}
          <div className='flex-shrink-0 border-b-2 border-b-amber-500/60 px-6 pt-4 pb-3'>
            <SheetHeader className='bg-transparent p-0'>
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
                canConvert={canConvert}
                isConverted={isConverted}
                onConvertToClient={() => {
                  setConvertDialogOpen(true)
                  pushActionUrl('convert')
                }}
              />
            )}
          </div>

          {/* Two Column Layout */}
          <Form {...form}>
            <form
              className='flex min-h-0 flex-1'
              onSubmit={form.handleSubmit(handleFormSubmit)}
            >
              {/* Left Column - Form Fields */}
              <div className='flex flex-1 flex-col overflow-hidden border-r'>
                <div className='flex-1 overflow-y-auto p-6'>
                  <LeadSheetFormFields
                    control={form.control}
                    assignees={assignees}
                    selectedSourceType={selectedSourceType}
                    leadId={lead?.id}
                  />
                </div>

                {/* Footer - Attached to left column */}
                <div className='flex-shrink-0 border-t bg-muted/50 px-6 py-4'>
                  <div className='flex w-full items-center justify-between gap-3'>
                    <div className='flex items-center gap-2'>
                      <DisabledFieldTooltip
                        disabled={submitDisabled}
                        reason={submitDisabledReason}
                      >
                        <Button
                          type='submit'
                          disabled={submitDisabled}
                          aria-label={`${saveLabel} (⌘S / Ctrl+S)`}
                          title={`${saveLabel} (⌘S / Ctrl+S)`}
                        >
                          {saveLabel}
                        </Button>
                      </DisabledFieldTooltip>
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        onClick={undo}
                        disabled={!canUndo}
                        aria-label='Undo (⌘Z / Ctrl+Z)'
                        title='Undo (⌘Z / Ctrl+Z)'
                      >
                        <Undo2 className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        onClick={redo}
                        disabled={!canRedo}
                        aria-label='Redo (⇧⌘Z / Ctrl+Shift+Z)'
                        title='Redo (⇧⌘Z / Ctrl+Shift+Z)'
                      >
                        <Redo2 className='h-4 w-4' />
                      </Button>
                    </div>
                    {isEditing && (
                      <DisabledFieldTooltip
                        disabled={submitDisabled}
                        reason={archiveDisabledReason}
                      >
                        <Button
                          type='button'
                          variant='destructive'
                          onClick={() => setArchiveDialogOpen(true)}
                          disabled={submitDisabled}
                          aria-label='Archive lead'
                          title='Archive lead'
                          size='icon'
                        >
                          <Archive className='h-4 w-4' />
                        </Button>
                      </DisabledFieldTooltip>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Actions & Panels (only for editing) */}
              {isEditing && lead && (
                <LeadSheetRightColumn
                  lead={lead}
                  assignees={assignees}
                  canManage={canManage}
                  senderName={senderName}
                  canConvert={canConvert}
                  isConverted={isConverted}
                  onSendEmail={() => {
                    setEmailDialogOpen(true)
                    pushActionUrl('email')
                  }}
                  onScheduleMeeting={(title?: string) => {
                    handleScheduleMeeting(title)
                    pushActionUrl('meeting')
                  }}
                  onBuildProposal={() => {
                    setBuildProposalDialogOpen(true)
                    pushActionUrl('proposals/new')
                  }}
                  onConvertToClient={() => {
                    setConvertDialogOpen(true)
                    pushActionUrl('convert')
                  }}
                  onRescore={handleRescore}
                  isRescoring={isRescoring}
                  onSuccess={onSuccess}
                />
              )}
            </form>
          </Form>
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
        onConvertOpenChange={(next: boolean) => {
          setConvertDialogOpen(next)
          if (!next) pushLeadUrl()
        }}
        isEmailDialogOpen={isEmailDialogOpen}
        onEmailOpenChange={(next: boolean) => {
          setEmailDialogOpen(next)
          if (!next) pushLeadUrl()
        }}
        isMeetingDialogOpen={isMeetingDialogOpen}
        meetingInitialTitle={meetingInitialTitle}
        onMeetingOpenChange={(next: boolean) => {
          setMeetingDialogOpen(next)
          if (!next) pushLeadUrl()
        }}
        onMeetingSuccess={() => {
          setMeetingDialogOpen(false)
          setMeetingInitialTitle(undefined)
          pushLeadUrl()
          onSuccess()
        }}
        isBuildProposalDialogOpen={isBuildProposalDialogOpen}
        onBuildProposalOpenChange={(next: boolean) => {
          setBuildProposalDialogOpen(next)
          if (!next) pushLeadUrl()
        }}
        onProposalSuccess={() => {
          setBuildProposalDialogOpen(false)
          pushLeadUrl()
          onSuccess()
        }}
        onSuccess={onSuccess}
        unsavedChangesDialog={unsavedChangesDialog}
      />
    </>
  )
}
