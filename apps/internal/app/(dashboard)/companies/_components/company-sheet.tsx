'use client'

import { cn } from '@/lib/utils'
import { SHEET_SECTIONS_CLASS } from '@/components/sheets/sheet-section'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'
import { archiveCompanyExtra } from '../_lib/archive-copy'
import { ARCHIVE_BILLED_REFUSAL } from '@/lib/companies/archive-refusal'
import { CLIENT_PRIMARY_ADMIN_ONLY } from '@/lib/companies/people-copy'
import { Skeleton } from '@pts/ui/skeleton'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { SheetNoticeSlot } from '@/components/sheets/sheet-notice-slot'
import { SheetRecordMenu } from '@/components/sheets/sheet-record-menu'
import { SheetPresence } from '@/components/sheets/sheet-presence'
import { Form } from '@/components/ui/form'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { toastLink, useToast } from '@/components/ui/use-toast'
import { COMPANY_OPTIONS_QUERY_KEY } from '@/components/companies/company-link-picker'
import { CONTACT_OPTIONS_QUERY_KEY } from '@/components/contacts/contact-link-picker'
import { roleCan } from '@/lib/auth/capabilities'
import { PENDING_REASON, getSubmitLabel } from '@/lib/forms/form-controls'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import {
  announceKeptOpenSave,
  type SheetSaveMode,
} from '@/lib/sheets/save-mode'
import { useSaveAndStay } from '@/lib/sheets/use-save-and-stay'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import type { CompanyBillingIntent } from '@/lib/companies/sheet-save-schema'
import { sameTagNames } from '@/lib/tags/names'
import { tagOptionsQueryKey } from '@/components/tags/use-tag-options'

import {
  fetchCompanyClientWork,
  fetchCompanySheet,
} from '@/lib/companies/sheet-fetch'

import { archiveCompany, saveCompanySheet } from '../actions'
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
import {
  clearSheetSectionTarget,
  peekSheetSectionTarget,
} from '@/lib/sheets/sheet-section-target'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { useSaveConflict } from '@/lib/sheets/save-conflict/use-save-conflict'
import { SaveConflictDialog } from '@/components/sheets/save-conflict-dialog'

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
 * People, Leads) and Client (the Bill this company switch and billing, then
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
    queryFn: () => fetchCompanySheet(companyId),
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
      tags: [],
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
  const saveConflict = useSaveConflict()
  // Bumped by Load theirs, to remount the billing state from fresh data.
  const [reloadCount, setReloadCount] = useState(0)
  const isDirty = form.formState.isDirty || billingDirty
  // Seeds the form from a loaded company. `keepEdits` keeps fields edited
  // since (a keep-open save re-seeding from what it just wrote).
  const seed = useCallback(
    (loaded: typeof company, keepEdits: boolean) => {
      seededFor.current = loaded ? `${loaded.id}:${loaded.updatedAt}` : 'new'
      saveConflict.seed(loaded?.updatedAt)
      form.reset(
        {
          name: loaded?.name ?? initialName ?? '',
          website: loaded?.website ?? '',
          linkedinUrl: loaded?.linkedinUrl ?? '',
          notes: loaded?.notes ?? '',
          tags: loaded?.tags ?? [],
          primaryContactId: loaded?.primaryContactId ?? null,
          addedContacts: [],
          removedContactIds: [],
          titles: Object.fromEntries(
            (loaded?.contacts ?? []).map(contact => [
              contact.id,
              contact.jobTitle ?? '',
            ])
          ),
          portalAccessIds: (loaded?.contacts ?? [])
            .filter(contact => contact.portalAccess)
            .map(contact => contact.id),
        },
        { keepDirtyValues: keepEdits }
      )
    },
    [form, initialName, saveConflict]
  )
  useEffect(() => {
    if (!data) return
    const key = company ? `${company.id}:${company.updatedAt}` : 'new'
    if (seededFor.current === key) return
    if (seededFor.current !== null && isDirty) return
    seed(company, false)
  }, [company, data, isDirty, seed])

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
        queryClient.invalidateQueries({
          queryKey: tagOptionsQueryKey('company'),
        }),
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
    queryFn: () => fetchCompanyClientWork(formerClientId!),
    enabled: Boolean(isAdmin && formerClientId),
    staleTime: 0,
  })
  const projectsCompanyId =
    clientCompanyId ??
    (formerClientId && (formerWork?.projects.length ?? 0) > 0
      ? formerClientId
      : null)
  const showProjects = isAdmin && isEditing && Boolean(projectsCompanyId)
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
  const seededTags = form.formState.defaultValues?.tags as string[] | undefined
  const { stay, isReopening } = useSaveAndStay('company', companyId, open)

  const handleSubmit = useCallback(
    (values: CompanyFormValues, mode: SheetSaveMode = 'close') => {
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
            link: toastLink('company', companyId),
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
          // Only when changed here: tags another sheet set since stay.
          tags:
            isEditing && sameTagNames(values.tags, seededTags ?? [])
              ? undefined
              : values.tags,
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
          expectedUpdatedAt: isEditing ? saveConflict.expected() : undefined,
        })

        if (saveConflict.catchConflict(result, mode)) return
        if (!result.ok) {
          toast({
            variant: 'destructive',
            title: 'Unable to save company',
            description: result.error ?? 'Please try again.',
            link: toastLink('company', companyId),
          })
          return
        }

        if (!isEditing && result.id) {
          onCreated?.({ id: result.id, name: values.name.trim() })
        }
        // Keep open: no toast; its Save button says "Saved".
        if (mode === 'close') {
          toast({
            title: isEditing ? 'Company saved' : 'Company created',
            description: values.name,
            link: toastLink('company', result.id ?? companyId),
          })
        }
        saveConflict.saved(result.updatedAt)
        form.reset(values)
        setBillingDirty(false)
        if (mode === 'stay' && isEditing) {
          // Refetch while still saving, then re-seed from the saved company
          // (people added here become its people, and Save checks its new
          // version), keeping anything typed since.
          await refresh(false)
          const saved = queryClient.getQueryData<typeof data>(
            companySheetQueryKey(companyId)
          )?.company
          if (saved) seed(saved, true)
          announceKeptOpenSave()
          return
        }
        await refresh()
        if (mode === 'stay') {
          // A new company: reopen as its own sheet.
          stay({ id: result.id, rebaseline: () => {} })
          return
        }
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
      queryClient,
      refresh,
      saveConflict,
      seed,
      seededPrimaryContactId,
      seededTags,
      seededTitles,
      stay,
      toast,
    ]
  )

  // Drop the edits, then re-seed from whatever the refetch brings.
  const handleLoadTheirs = useCallback(() => {
    // Any key but the current one: the seed effect takes the next record,
    // but still not over edits typed while it loads.
    seededFor.current = `${company?.id ?? 'new'}:reload`
    form.reset()
    setBillingDirty(false)
    setReloadCount(count => count + 1)
    void refresh(false)
  }, [company?.id, form, refresh])

  const handleSave = useCallback(
    (mode: SheetSaveMode = 'close') => {
      // Reports its own result; validation errors stay on fields.
      void form.handleSubmit(values => handleSubmit(values, mode))()
    },
    [form, handleSubmit]
  )

  const submitDisabled = isPending || isReopening || isLoading || isArchived
  const { undo, redo, canUndo, canRedo, sources } = useSheetFormControls({
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
          link: toastLink('company', companyId),
        })
        return
      }
      toast({
        title: 'Company archived',
        description: company?.name,
        link: toastLink('company', companyId),
      })
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
            presence={
              <SheetPresence
                entity='company'
                noun='company'
                recordId={companyId ?? null}
                open={open}
                isDirty={isDirty}
                guard={saveConflict}
                onLoadTheirs={handleLoadTheirs}
              />
            }
            title={isEditing ? (company?.name ?? 'Company') : 'Create company'}
            leading={
              <ENTITY_ICONS.company
                aria-hidden
                className={`${ENTITY_ACCENTS.company.icon} size-4 shrink-0`}
              />
            }
            className='flex-shrink-0'
            menu={
              // An archived company is restored from the archive list.
              isEditing && company && !isArchived ? (
                <SheetRecordMenu
                  noun='Company'
                  onRequestArchive={() => setArchiveOpen(true)}
                  archiveDisabled={isPending || Boolean(archiveRefusal)}
                  archiveDisabledReason={
                    isPending ? PENDING_REASON : archiveRefusal
                  }
                />
              ) : null
            }
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
                key={`${company?.id ?? 'new'}:${reloadCount}`}
                companyId={isAdmin ? (clientCompanyId ?? formerClientId) : null}
                billed={Boolean(clientCompanyId)}
                wasClient={Boolean(isAdmin && company?.formerClientId)}
                billingEndsOn={company?.billingEndsOn ?? null}
                open={open && isAdmin}
                isPending={fieldsDisabled}
                handleRef={billingRef}
                onDirtyChange={setBillingDirty}
                history={sources}
              >
                {/* Two columns. Below lg they stack into one scroll (Company,
                    then Client) with the footer pinned to the bottom. */}
                <form
                  id={COMPANY_FORM_ID}
                  onSubmit={event => {
                    event.preventDefault()
                    // The save reports its own result as a toast.
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
                      <SheetNoticeSlot />
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
                        isEditing={isEditing}
                        onSave={handleSave}
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
                  />
                </form>
              </CompanyBillingProvider>
            </Form>
          )}
        </SheetContent>
      </Sheet>
      <ArchiveConfirmDialog
        open={archiveOpen}
        entity='company'
        name={company?.name || 'this company'}
        list='the Companies list'
        extra={archiveCompanyExtra(Boolean(company?.formerClientId))}
        pending={isPending}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={handleArchive}
      />
      {unsavedChangesDialog}
      <SaveConflictDialog
        guard={saveConflict}
        yours={() => form.getValues()}
        noun='company'
        onOverwrite={handleSave}
        onLoadTheirs={handleLoadTheirs}
      />
    </>
  )
}
