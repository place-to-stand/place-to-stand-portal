'use client'

import { useSheetParams } from '@/lib/sheets/use-sheet-params'

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
  const { open: openSheet } = useSheetParams()
  const { open, lead, assignees, canManage = false, onSuccess } = props
  const {
    form,
    isEditing,
    isArchiving,
    isArchiveDialogOpen,
    setArchiveDialogOpen,
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
          // Create and edit share one layout: the form plus the tasks and
          // updates column, which waits for the lead to exist on create.
          columns={2}
          className='flex h-full w-full flex-col gap-0 overflow-hidden p-0'
        >
          {/* Header */}
          <SheetFormHeader
            entity='lead'
            title={isEditing ? lead?.contactName || 'Lead' : 'Create lead'}
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
                  'flex flex-1 flex-col overflow-hidden max-lg:contents lg:border-r'
                )}
              >
                <div className='flex-1 p-6 lg:overflow-y-auto'>
                  <LeadSheetFormFields
                    control={form.control}
                    assignees={assignees}
                    selectedSourceType={selectedSourceType}
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
                    archiveDisabled={submitDisabled}
                    archiveDisabledReason={archiveDisabledReason}
                    onRequestArchive={() => setArchiveDialogOpen(true)}
                    archiveAriaLabel='Archive lead'
                  />
                </div>
              </div>

              {/* Right Column - Conversion, tasks, updates. On create the
                  sections show but wait for the lead to exist. */}
              <LeadSheetRightColumn
                lead={lead}
                canManage={canManage}
                canConvert={canConvert}
                onConvertToClient={() => {
                  // A client is made on its company's Billing tab: stack the
                  // company's sheet on the lead, on that tab.
                  if (lead?.companyId) {
                    openSheet('company', lead.companyId, { tab: 'billing' })
                  }
                }}
                onSuccess={onSuccess}
              />
            </form>
          </Form>
        </SheetContent>
      </Sheet>
      <LeadSheetDialogs
        isArchiveDialogOpen={isArchiveDialogOpen}
        leadName={lead?.contactName}
        isArchiving={isArchiving}
        onArchiveCancel={() => {
          if (!isArchiving) {
            setArchiveDialogOpen(false)
          }
        }}
        onArchiveConfirm={handleArchive}
        unsavedChangesDialog={unsavedChangesDialog}
      />
    </>
  )
}
