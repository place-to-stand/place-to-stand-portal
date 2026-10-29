'use client'

import { Form } from '@/components/ui/form'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { useLeadSheetState } from '@/lib/leads/use-lead-sheet-state'
import { cn } from '@/lib/utils'

import { LeadSheetDialogs } from './lead-sheet-dialogs'
import { LeadSheetFormFields } from './lead-sheet-form-fields'
import { LeadSheetRightColumn } from './lead-sheet-right-column'
import type { LeadSheetProps } from './types'

const LEAD_FORM_ID = 'lead-form'

export function LeadSheet(props: LeadSheetProps) {
  const { open, lead, assignees, canManage = false, onSuccess } = props
  const {
    form,
    isEditing,
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
  } = useLeadSheetState(props)

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          hideCloseButton
          size='2xl'
          className={cn(
            'flex h-full w-full flex-col gap-0 overflow-hidden p-0',
            // Edit mode appends the fixed-width tasks and updates sidebar
            // (480px) while the form column stays at the same 672px as add
            // mode. Below lg the sidebar stacks under the form, so the sheet
            // keeps its add width.
            isEditing && 'lg:max-w-[1152px]'
          )}
        >
          {/* Header */}
          <SheetFormHeader
            entity='lead'
            title={isEditing ? 'Edit lead' : 'Add lead'}
            className='flex-shrink-0'
          />

          {/* Two Column Layout. Below lg the columns stack into one scroll
              (fields, then the right column) with the footer pinned to the
              bottom: side by side, the form column was too narrow to use. */}
          <Form {...form}>
            <form
              id={LEAD_FORM_ID}
              className='flex min-h-0 flex-1 max-lg:flex-col max-lg:overflow-y-auto'
              onSubmit={form.handleSubmit(handleFormSubmit)}
            >
              {/* Left Column - Form Fields */}
              <div
                className={cn(
                  'flex flex-1 flex-col overflow-hidden max-lg:contents',
                  isEditing && lead && 'lg:border-r'
                )}
              >
                <div className='flex-1 p-6 lg:overflow-y-auto'>
                  <LeadSheetFormFields
                    control={form.control}
                    assignees={assignees}
                    selectedSourceType={selectedSourceType}
                    companyId={lead?.companyId ?? null}
                  />
                </div>

                {/* Footer - Attached to left column */}
                <div className='max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:order-last'>
                  <SheetFormFooter
                    formId={LEAD_FORM_ID}
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
                </div>
              </div>

              {/* Right Column - Conversion, tasks, updates (only for editing) */}
              {isEditing && lead && (
                <LeadSheetRightColumn
                  lead={lead}
                  canManage={canManage}
                  canConvert={canConvert}
                  onConvertToClient={() => {
                    setConvertDialogOpen(true)
                    setActionParam('convert')
                  }}
                  onSuccess={onSuccess}
                />
              )}
            </form>
          </Form>
        </SheetContent>
      </Sheet>
      <LeadSheetDialogs
        lead={lead}
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
          if (!next) setActionParam(null)
        }}
        onSuccess={onSuccess}
        unsavedChangesDialog={unsavedChangesDialog}
      />
    </>
  )
}
