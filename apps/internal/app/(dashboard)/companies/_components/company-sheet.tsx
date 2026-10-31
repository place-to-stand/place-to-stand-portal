'use client'

import { cn } from '@/lib/utils'
import { SHEET_SECTIONS_CLASS } from '@/components/sheets/sheet-section'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { archiveCompanyDescription } from '../_lib/archive-copy'
import { ARCHIVE_BILLED_REFUSAL } from '@/lib/companies/archive-refusal'
import { CLIENT_PRIMARY_ADMIN_ONLY } from '@/lib/companies/people-copy'
import { Skeleton } from '@pts/ui/skeleton'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { Form } from '@/components/ui/form'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'
import { COMPANY_OPTIONS_QUERY_KEY } from '@/components/companies/company-link-picker'
import { CONTACT_OPTIONS_QUERY_KEY } from '@/components/contacts/contact-link-picker'
import { roleCan } from '@/lib/auth/capabilities'
import { PENDING_REASON, getSubmitLabel } from '@/lib/forms/form-controls'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import type { CompanyBillingIntent } from '@/lib/companies/sheet-save-schema'

import {
  archiveCompany,
  loadCompanyClientWork,
  loadCompanySheet,
  saveCompanySheet,
} from '../actions'
import {
  companyFormSchema,
  companySheetQueryKey,
  useCompanySheetForm,
  type CompanyFormValues,
} from './use-company-sheet-form'
import { CompanyLeadsSection } from './company-sheet-sections'
import {
  COMPANY_BILLING_SECTION_ID,
  COMPANY_PROJECTS_SECTION_ID,
  CompanyClientColumn,
} from './company-client-column'
import { useScrollToSection } from './use-scroll-to-section'
import {
  CompanyBillingProvider,
  type CompanyBillingHandle,
} from './company-billing-section'
import { CompanyDetailsFields } from './company-details-fields'
import { CompanyPeopleTab } from './company-people-tab'
import { ClientBadge } from '@/components/clients/client-badge'
import {
  clearSheetSectionTarget,
  peekSheetSectionTarget,
} from '@/lib/sheets/sheet-section-target'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'

const COMPANY_FORM_ID = 'company-form'
const COMPANY_PEOPLE_SECTION_ID = 'company-people'
const ARCHIVED_COMPANY_NOTE = 'Archived. Restore it from the archive list.'

type CompanySheetProps = {
  /** `null` opens the create sheet. */
  companyId: string | null
  open: boolean
  onClose: () => void
  /** Prefills the name on the create sheet (create-from-picker). */
  initialName?: string
  /** Fires with the new record after a create, for the picker underneath. */
  onCreated?: (record: { id: string; name: string }) => void
}

/**
 * Create and edit are the same sheet, in two columns: Company (details,
 * People, Leads, Updates) and Client (the Bill this company switch and billing, then
 * Projects; read-only for Sales). One Save writes all of it — the company,
 * its people, billing and portal access — in one transaction.
 */
export function CompanySheet({
  companyId,
  open,
  onClose,
  initialName,
  onCreated,
}: CompanySheetProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [archiveOpen, setArchiveOpen] = useState(false)
  // The Client column's billing state (admins); read by Save.
  const billingRef = useRef<CompanyBillingHandle>(null)
  const [billingDirty, setBillingDirty] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: companySheetQueryKey(companyId),
    queryFn: () => loadCompanySheet(companyId),
    staleTime: 0,
    // A refocus refetch would re-seed the form over unsaved edits.
    refetchOnWindowFocus: false,
  })

  const company = data?.company ?? null
  const isEditing = Boolean(companyId)
  const isArchived = Boolean(company?.deletedAt)

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: '',
      website: '',
      linkedinUrl: '',
      notes: '',
      primaryContactId: null,
      addedContacts: [],
      removedContactIds: [],
      titles: {},
      portalAccessIds: [],
    },
  })

  // Seed the form once per loaded record, and never over unsaved edits (a
  // refetch while dirty waits until the form is clean again). The version it
  // was seeded from goes back with Save, so a save made since is caught.
  const seededFor = useRef<string | null>(null)
  const seededUpdatedAt = useRef<string | null>(null)
  const isDirty = form.formState.isDirty || billingDirty
  useEffect(() => {
    if (!data) return
    const key = company ? `${company.id}:${company.updatedAt}` : 'new'
    if (seededFor.current === key) return
    if (seededFor.current !== null && isDirty) return
    seededFor.current = key
    seededUpdatedAt.current = company?.updatedAt ?? null
    form.reset({
      name: company?.name ?? initialName ?? '',
      website: company?.website ?? '',
      linkedinUrl: company?.linkedinUrl ?? '',
      notes: company?.notes ?? '',
      primaryContactId: company?.primaryContactId ?? null,
      addedContacts: [],
      removedContactIds: [],
      titles: Object.fromEntries(
        (company?.contacts ?? []).map(contact => [
          contact.id,
          contact.jobTitle ?? '',
        ])
      ),
      portalAccessIds: (company?.contacts ?? [])
        .filter(contact => contact.portalAccess)
        .map(contact => contact.id),
    })
  }, [company, data, form, initialName, isDirty])

  const { requestConfirmation, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty })

  const refresh = useCallback(
    async (closing = true) => {
      // A sheet about to close only marks its own queries stale for next open.
      const refetchType = closing ? ('none' as const) : ('active' as const)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['companySheet'],
          refetchType,
        }),
        queryClient.invalidateQueries({
          queryKey: ['clientBilling'],
          refetchType,
        }),
        queryClient.invalidateQueries({
          queryKey: ['companyClientWork'],
          refetchType,
        }),
        queryClient.invalidateQueries({ queryKey: COMPANY_OPTIONS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CONTACT_OPTIONS_QUERY_KEY }),
      ])
      router.refresh()
    },
    [queryClient, router]
  )

  // Portal access and billing are client records: admins only.
  const { isAdmin, role } = useViewerAccess()
  const canManageClients = roleCan(role, 'clients.manage')

  const clientCompanyId = company?.clients[0]?.id ?? null
  const formerClientId = clientCompanyId
    ? null
    : (company?.formerClientId ?? null)
  // A former client keeps its Projects only while it has projects.
  const { data: formerWork } = useQuery({
    queryKey: ['companyClientWork', formerClientId],
    queryFn: () => loadCompanyClientWork(formerClientId!),
    enabled: Boolean(isAdmin && formerClientId),
    staleTime: 0,
  })
  const projectsCompanyId =
    clientCompanyId ??
    (formerClientId && (formerWork?.projects.length ?? 0) > 0
      ? formerClientId
      : null)
  const showProjects = isAdmin && isEditing && Boolean(projectsCompanyId)
  // Client updates sit on the Company column, for clients and former ones.
  const updatesCompanyId = clientCompanyId ?? formerClientId
  // Opening the sheet at a section (a lead's Won lands on billing) is
  // handed over in memory, not a URL param. Old `?tab=` links still open
  // the sheet; the param is ignored and dropped on close.
  const requestedSection =
    open && data && companyId
      ? peekSheetSectionTarget('company', companyId)
      : null
  useEffect(() => {
    if (!open && companyId) clearSheetSectionTarget('company', companyId)
  }, [open, companyId])
  useScrollToSection(
    requestedSection === 'people'
      ? COMPANY_PEOPLE_SECTION_ID
      : requestedSection === 'billing'
        ? COMPANY_BILLING_SECTION_ID
        : requestedSection === 'projects'
          ? showProjects
            ? COMPANY_PROJECTS_SECTION_ID
            : COMPANY_BILLING_SECTION_ID
          : null
  )

  // What the form was seeded with (reset values), not the live query data.
  const seededTitles = form.formState.defaultValues?.titles as
    Record<string, string> | undefined
  const seededPrimaryContactId =
    form.formState.defaultValues?.primaryContactId ?? null
  const handleSubmit = useCallback(
    (values: CompanyFormValues) => {
      const handle = billingRef.current
      let billing: CompanyBillingIntent = { kind: 'none' }
      if (isAdmin && handle) {
        const collected = handle.collect()
        if (!collected) {
          document
            .getElementById(COMPANY_BILLING_SECTION_ID)
            ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
          toast({
            variant: 'destructive',
            title: 'Unable to save company',
            description: 'Check the billing before saving.',
          })
          return
        }
        billing = collected
      }
      // Portal switches show while the company is (or is becoming) billed,
      // and on a former client.
      const sendPortal = canManageClients && Boolean(handle?.portalShown())

      startTransition(async () => {
        const result = await saveCompanySheet({
          id: companyId ?? undefined,
          name: values.name,
          website: values.website,
          linkedinUrl: values.linkedinUrl,
          notes: values.notes,
          addContactIds: values.addedContacts.map(contact => contact.id),
          removeContactIds: values.removedContactIds,
          // Only titles edited here (or that people joining here bring),
          // diffed against what the form was seeded with: a title another
          // sheet changed since then is not written back.
          contactTitles: Object.entries(values.titles)
            .filter(([contactId, title]) => {
              if (values.removedContactIds.includes(contactId)) return false
              const seeded = seededTitles?.[contactId]
              return seeded !== undefined
                ? seeded.trim() !== title.trim()
                : values.addedContacts.some(c => c.id === contactId) &&
                    title.trim() !== ''
            })
            .map(([contactId, title]) => ({ contactId, title })),
          // Only when the star moved here.
          primaryContactId:
            values.primaryContactId !== seededPrimaryContactId
              ? values.primaryContactId
              : undefined,
          billing,
          portalAccessContactIds: sendPortal
            ? values.portalAccessIds.filter(
                id => !values.removedContactIds.includes(id)
              )
            : undefined,
          // The version this sheet loaded: a save made since refuses this one.
          expectedUpdatedAt: isEditing
            ? (seededUpdatedAt.current ?? undefined)
            : undefined,
        })

        if (!result.ok) {
          toast({
            variant: 'destructive',
            title: 'Unable to save company',
            description: result.error ?? 'Please try again.',
          })
          return
        }

        if (!isEditing && result.id) {
          onCreated?.({ id: result.id, name: values.name.trim() })
        }
        toast({
          title: isEditing ? 'Company saved' : 'Company created',
          description: values.name,
        })
        form.reset(values)
        setBillingDirty(false)
        await refresh()
        // Save = done = close, for create and edit alike.
        onClose()
      })
    },
    [
      canManageClients,
      companyId,
      form,
      isAdmin,
      isEditing,
      onClose,
      onCreated,
      refresh,
      seededPrimaryContactId,
      seededTitles,
      toast,
    ]
  )

  const handleSave = useCallback(
    () => form.handleSubmit(handleSubmit)(),
    [form, handleSubmit]
  )

  const submitDisabled = isPending || isLoading || isArchived
  const { undo, redo, canUndo, canRedo } = useSheetFormControls({
    form,
    isActive: open,
    canSave: !submitDisabled,
    onSave: handleSave,
    historyKey: companyId ?? 'company:new',
  })

  // Archived companies are restored from the archive list, not here.
  const handleArchive = useCallback(() => {
    if (!companyId || isArchived) return
    startTransition(async () => {
      const result = await archiveCompany(companyId)
      setArchiveOpen(false)
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: 'Unable to archive company',
          description: result.error ?? 'Please try again.',
        })
        return
      }
      toast({ title: 'Company archived', description: company?.name })
      await refresh()
      onClose()
    })
  }, [company?.name, companyId, isArchived, onClose, refresh, toast])

  // Sales builds the directory, client companies included; the staff
  // company's people and a client's primary contact stay admin-only (the
  // server agrees).
  const peopleLocked = !isAdmin && Boolean(company?.isStaff)
  const primaryLockedReason =
    !canManageClients && clientCompanyId ? CLIENT_PRIMARY_ADMIN_ONLY : null
  const {
    titles,
    primaryContactId,
    addedContacts,
    removedContactIds,
    movesFrom,
    handleTitleChange,
    handleSetPrimary,
    handleAddPerson,
    handleRemovePerson,
    handleUndoRemovePerson,
    portalAccessIds,
    handlePortalAccessChange,
  } = useCompanySheetForm({ form, company, companyId })

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next || isPending) return
      requestConfirmation(onClose)
    },
    [isPending, onClose, requestConfirmation]
  )

  const fieldsDisabled = isPending || isArchived
  // Same rule as the server: a billed company stops billing before archiving.
  const archiveRefusal = clientCompanyId ? ARCHIVE_BILLED_REFUSAL : null

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          hideCloseButton
          // Create and edit share one layout: Company, then the Client column.
          columns={2}
          className='flex h-full w-full flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader
            entity='company'
            title={isEditing ? (company?.name ?? 'Company') : 'Create company'}
            leading={
              <ENTITY_ICONS.company
                aria-hidden
                className={`${ENTITY_ACCENTS.company.icon} size-4 shrink-0`}
              />
            }
            badges={clientCompanyId ? <ClientBadge /> : null}
            className='flex-shrink-0'
          />
          {isError || (isEditing && data === null) ? (
            <p className='text-muted-foreground p-6 text-sm'>
              This company could not be found.
            </p>
          ) : isLoading || !data ? (
            <div className='space-y-4 p-6'>
              <Skeleton className='h-9 w-full' />
              <Skeleton className='h-9 w-full' />
              <Skeleton className='h-24 w-full' />
            </div>
          ) : (
            <Form {...form}>
              <CompanyBillingProvider
                key={company?.id ?? 'new'}
                companyId={isAdmin ? (clientCompanyId ?? formerClientId) : null}
                billed={Boolean(clientCompanyId)}
                wasClient={Boolean(isAdmin && company?.formerClientId)}
                billingEndsOn={company?.billingEndsOn ?? null}
                open={open && isAdmin}
                isPending={fieldsDisabled}
                handleRef={billingRef}
                onDirtyChange={setBillingDirty}
              >
                {/* Two columns. Below lg they stack into one scroll (Company,
                    then Client) with the footer pinned to the bottom. */}
                <form
                  id={COMPANY_FORM_ID}
                  onSubmit={event => {
                    event.preventDefault()
                    handleSave()
                  }}
                  className='flex min-h-0 flex-1 max-lg:flex-col max-lg:overflow-y-auto'
                >
                  {/* Company */}
                  <div className='flex flex-1 flex-col overflow-hidden max-lg:contents lg:border-r'>
                    <div
                      className={cn(
                        SHEET_SECTIONS_CLASS,
                        'flex-1 px-6 pt-6 pb-8 lg:overflow-y-auto [&>*]:shrink-0'
                      )}
                    >
                      {isArchived ? (
                        <p className='text-muted-foreground text-sm'>
                          {ARCHIVED_COMPANY_NOTE}
                        </p>
                      ) : null}
                      <CompanyDetailsFields
                        control={form.control}
                        disabled={fieldsDisabled}
                      />
                      <div
                        id={COMPANY_PEOPLE_SECTION_ID}
                        className='scroll-mt-6'
                      >
                        <CompanyPeopleTab
                          contacts={company?.contacts ?? []}
                          added={addedContacts}
                          removedIds={removedContactIds}
                          movesFrom={movesFrom}
                          primaryContactId={primaryContactId}
                          clientName={company?.clients[0]?.name ?? null}
                          disabled={fieldsDisabled || peopleLocked}
                          lockedReason={
                            peopleLocked
                              ? `Only an admin can change the people at ${company?.name ?? 'this company'}.`
                              : null
                          }
                          primaryLockedReason={primaryLockedReason}
                          titles={titles}
                          titleDisabled={fieldsDisabled || peopleLocked}
                          onTitleChange={handleTitleChange}
                          onSetPrimary={handleSetPrimary}
                          onAdd={handleAddPerson}
                          onRemove={handleRemovePerson}
                          onUndoRemove={handleUndoRemovePerson}
                          portal={
                            canManageClients
                              ? {
                                  ids: portalAccessIds,
                                  onChange: handlePortalAccessChange,
                                  disabled: fieldsDisabled,
                                }
                              : null
                          }
                        />
                      </div>
                      <CompanyLeadsSection leads={company?.leads ?? []} />
                    </div>
                    <div className='max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:order-last'>
                      <SheetFormFooter
                        formId={COMPANY_FORM_ID}
                        saveLabel={getSubmitLabel({
                          isSaving: isPending,
                          isEditing,
                          createLabel: 'Create company',
                        })}
                        submitDisabled={submitDisabled}
                        submitDisabledReason={
                          isPending
                            ? PENDING_REASON
                            : isArchived
                              ? ARCHIVED_COMPANY_NOTE
                              : null
                        }
                        undo={undo}
                        redo={redo}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        // An archived company has no archive action here.
                        isEditing={isEditing && !isArchived}
                        archiveDisabled={
                          isPending || !isEditing || Boolean(archiveRefusal)
                        }
                        archiveDisabledReason={
                          isPending ? PENDING_REASON : archiveRefusal
                        }
                        onRequestArchive={() => setArchiveOpen(true)}
                        archiveAriaLabel='Archive company'
                      />
                    </div>
                  </div>

                  {/* Client */}
                  <CompanyClientColumn
                    canManage={isAdmin}
                    clientCompanyId={clientCompanyId}
                    wasClient={Boolean(company?.formerClientId)}
                    projectsCompanyId={showProjects ? projectsCompanyId : null}
                    isEditing={isEditing}
                    disabled={fieldsDisabled}
                    updatesCompanyId={
                      isAdmin && isEditing ? (updatesCompanyId ?? null) : null
                    }
                  />
                </form>
              </CompanyBillingProvider>
            </Form>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={archiveOpen}
        title='Archive company?'
        description={archiveCompanyDescription(
          company?.name,
          Boolean(company?.formerClientId)
        )}
        confirmLabel='Archive company'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={handleArchive}
      />
      {unsavedChangesDialog}
    </>
  )
}
