'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { archiveCompanyDescription } from '../_lib/archive-copy'
import { Input } from '@pts/ui/input'
import { UrlInput } from '@/components/ui/url-input'
import { Separator } from '@pts/ui/separator'
import { Skeleton } from '@pts/ui/skeleton'
import { FormFeedback } from '@/components/sheets/form-feedback'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { SheetSection } from '@/components/sheets/sheet-section'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'
import { COMPANY_OPTIONS_QUERY_KEY } from '@/components/companies/company-link-picker'
import { CLIENT_LINK_OPTIONS_QUERY_KEY } from '@/components/clients/client-link-picker'
import { CONTACT_OPTIONS_QUERY_KEY } from '@/components/contacts/contact-link-picker'
import { PENDING_REASON, getSubmitLabel } from '@/lib/forms/form-controls'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'

import {
  archiveCompany,
  loadCompanySheet,
  restoreCompany,
  saveCompany,
} from '../actions'
import {
  companyFormSchema,
  companySheetQueryKey,
  useCompanySheetForm,
  type CompanyFormValues,
} from './use-company-sheet-form'
import {
  CompanyBillingTab,
  CompanyLeadsSection,
  CompanyProjectsTab,
} from './company-sheet-sections'
import {
  CompanyBillingProvider,
  useCompanyPortalAccess,
  type CompanyBillingHandle,
} from './company-billing-section'
import { CompanyPeopleSection } from './company-people-section'
import { ClientBadge } from '@/components/clients/client-badge'
import { SheetTabs, useSheetTab } from '@/components/sheets/sheet-tabs'
import { ENTITY_ACCENTS } from '@/lib/entity-accents'
import { Building2 } from 'lucide-react'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'

const COMPANY_FORM_ID = 'company-form'

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
  const [feedback, setFeedback] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  // The Billing section (a client company, admins only) saves with Save.
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
    },
  })

  // Seed the form once per loaded record, and never over unsaved edits (a
  // refetch while dirty waits until the form is clean again).
  const seededFor = useRef<string | null>(null)
  const isDirty = form.formState.isDirty || billingDirty
  useEffect(() => {
    if (!data) return
    const key = company ? `${company.id}:${company.updatedAt}` : 'new'
    if (seededFor.current === key) return
    if (seededFor.current !== null && form.formState.isDirty) return
    seededFor.current = key
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
    })
  }, [company, data, form, initialName, isDirty])

  const { requestConfirmation, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty })

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['companySheet'] }),
      queryClient.invalidateQueries({ queryKey: COMPANY_OPTIONS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: CONTACT_OPTIONS_QUERY_KEY }),
      queryClient.invalidateQueries({
        queryKey: CLIENT_LINK_OPTIONS_QUERY_KEY,
      }),
    ])
    router.refresh()
  }, [queryClient, router])

  // What the form was seeded with (reset values), not the live query data.
  const seededTitles = form.formState.defaultValues?.titles as
    Record<string, string> | undefined
  const seededPrimaryContactId =
    form.formState.defaultValues?.primaryContactId ?? null
  const handleSubmit = useCallback(
    (values: CompanyFormValues) => {
      setFeedback(null)
      startTransition(async () => {
        const result = await saveCompany({
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
          // Only when the star moved here; saved in the same transaction.
          primaryContactId:
            companyId && values.primaryContactId !== seededPrimaryContactId
              ? values.primaryContactId
              : undefined,
        })

        if (!result.ok) {
          setFeedback(result.error ?? 'Unable to save the company.')
          return
        }

        if (!isEditing && result.id) {
          onCreated?.({ id: result.id, name: values.name.trim() })
        }
        toast({
          title: isEditing ? 'Company updated' : 'Company created',
          description: values.name,
        })
        form.reset(values)
        // Billing edits save next; their save closes the sheet.
        const billing = billingRef.current
        if (billing?.isDirty()) {
          billing.submit()
          return
        }
        await refresh()
        // Save = done = close, for create and edit alike.
        onClose()
      })
    },
    [
      seededTitles,
      seededPrimaryContactId,
      companyId,
      form,
      isEditing,
      onClose,
      onCreated,
      refresh,
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

  const handleArchiveToggle = useCallback(() => {
    if (!companyId) return
    startTransition(async () => {
      const result = isArchived
        ? await restoreCompany(companyId)
        : await archiveCompany(companyId)
      setArchiveOpen(false)
      if (!result.ok) {
        setFeedback(result.error ?? 'Unable to update the company.')
        return
      }
      toast({
        title: isArchived ? 'Company restored' : 'Company archived',
        description: company?.name,
      })
      await refresh()
      if (!isArchived) onClose()
    })
  }, [company?.name, companyId, isArchived, onClose, refresh, toast])

  // A client's people and primary contact are admin-only (the server agrees).
  const { isAdmin } = useViewerAccess()
  const peopleLocked = !isAdmin && Boolean(company?.clients.length)
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
  } = useCompanySheetForm({ form, company, companyId })

  const clientId = company?.clients[0]?.id ?? null
  const tabValues = isAdmin
    ? ['details', 'people', 'projects', 'billing']
    : ['details', 'people']
  const [tab, setTab] = useSheetTab(tabValues)
  const dirtyFields = form.formState.dirtyFields
  const detailsDirty = Boolean(
    dirtyFields.name ||
      dirtyFields.website ||
      dirtyFields.linkedinUrl ||
      dirtyFields.notes
  )
  const peopleDirty = Boolean(
    dirtyFields.addedContacts ||
      dirtyFields.removedContactIds ||
      dirtyFields.titles ||
      dirtyFields.primaryContactId
  )

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next || isPending) return
      requestConfirmation(onClose)
    },
    [isPending, onClose, requestConfirmation]
  )

  const fieldsDisabled = isPending || isArchived

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          hideCloseButton
          size='xl'
          className='flex w-full flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader
            entity='company'
            title={
              isEditing ? (company?.name ?? 'Company') : 'Create company'
            }
            leading={
              <Building2
                aria-hidden
                className={`${ENTITY_ACCENTS.company.icon} size-4 shrink-0`}
              />
            }
            badges={clientId ? <ClientBadge /> : null}
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
              <div className='flex-1 overflow-y-auto'>
                <form
                  id={COMPANY_FORM_ID}
                  onSubmit={event => {
                    event.preventDefault()
                    handleSave()
                  }}
                  className='flex flex-col'
                >
                  {company ? (
                    <CompanyBillingProvider
                      companyId={company.id}
                      clientId={isAdmin ? clientId : null}
                      formerClientId={isAdmin ? company.formerClientId : null}
                      open={open}
                      handleRef={billingRef}
                      onDirtyChange={setBillingDirty}
                      onSaved={async () => {
                        setBillingDirty(false)
                        await refresh()
                        onClose()
                      }}
                    >
                      <SheetTabs
                        value={tab}
                        onValueChange={setTab}
                        tabs={[
                          {
                            value: 'details',
                            label: 'Details',
                            dirty: detailsDirty,
                            content: (
                              <>
                                <SheetSection title='Details'>
                                  <FormField
                                    control={form.control}
                                    name='name'
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            placeholder='Acme Inc.'
                                            disabled={fieldsDisabled}
                                            data-autofocus
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name='website'
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel optional>Website</FormLabel>
                                        <FormControl>
                                          <UrlInput
                                            {...field}
                                            openLabel='Open website'
                                            placeholder='acme.com'
                                            disabled={fieldsDisabled}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name='linkedinUrl'
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel optional>LinkedIn</FormLabel>
                                        <FormControl>
                                          <UrlInput
                                            {...field}
                                            openLabel='Open LinkedIn'
                                            placeholder='linkedin.com/company/acme'
                                            disabled={fieldsDisabled}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name='notes'
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel optional>Notes</FormLabel>
                                        <FormControl>
                                          <RichTextEditor
                                            id='company-notes'
                                            value={field.value ?? ''}
                                            onChange={field.onChange}
                                            disabled={fieldsDisabled}
                                            contentMinHeightClassName='[&_.ProseMirror]:min-h-[140px]'
                                            undoRedo={false}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </SheetSection>

                                <Separator />
                                <CompanyLeadsSection leads={company.leads} />
                              </>
                            ),
                          },
                          {
                            value: 'people',
                            label: 'People',
                            dirty: peopleDirty,
                            content: (
                              <CompanyPeopleTab
                                contacts={company.contacts}
                                added={addedContacts}
                                removedIds={removedContactIds}
                                movesFrom={movesFrom}
                                primaryContactId={primaryContactId}
                                clientName={company.clients[0]?.name ?? null}
                                disabled={fieldsDisabled || peopleLocked}
                                lockedReason={
                                  peopleLocked
                                    ? 'This company is a client, so an admin changes its people and primary contact.'
                                    : null
                                }
                                titles={titles}
                                titleDisabled={fieldsDisabled}
                                onTitleChange={handleTitleChange}
                                onSetPrimary={handleSetPrimary}
                                onAdd={handleAddPerson}
                                onRemove={handleRemovePerson}
                                onUndoRemove={handleUndoRemovePerson}
                              />
                            ),
                          },
                          ...(isAdmin
                            ? [
                                {
                                  value: 'projects',
                                  label: 'Projects',
                                  content: (
                                    <CompanyProjectsTab clientId={clientId} />
                                  ),
                                },
                                {
                                  value: 'billing',
                                  label: 'Billing',
                                  dirty: billingDirty,
                                  content: (
                                    <CompanyBillingTab
                                      clientId={clientId}
                                      disabled={fieldsDisabled}
                                    />
                                  ),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </CompanyBillingProvider>
                  ) : (
                    <div className='flex flex-col gap-6 px-6 pt-6 pb-8'>
                  <SheetSection title='Details'>
                    <FormField
                      control={form.control}
                      name='name'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder='Acme Inc.'
                              disabled={fieldsDisabled}
                              data-autofocus
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='website'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel optional>Website</FormLabel>
                          <FormControl>
                            <UrlInput
                              {...field}
                              openLabel='Open website'
                              placeholder='acme.com'
                              disabled={fieldsDisabled}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='linkedinUrl'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel optional>LinkedIn</FormLabel>
                          <FormControl>
                            <UrlInput
                              {...field}
                              openLabel='Open LinkedIn'
                              placeholder='linkedin.com/company/acme'
                              disabled={fieldsDisabled}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='notes'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel optional>Notes</FormLabel>
                          <FormControl>
                            <RichTextEditor
                              id='company-notes'
                              value={field.value ?? ''}
                              onChange={field.onChange}
                              disabled={fieldsDisabled}
                              contentMinHeightClassName='[&_.ProseMirror]:min-h-[140px]'
                              undoRedo={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SheetSection>

                    </div>
                  )}
                  <div className='px-6 pb-6 empty:hidden'>
                    <FormFeedback>{feedback}</FormFeedback>
                  </div>
                </form>
              </div>
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
                      ? 'Restore the company to edit it.'
                      : null
                }
                undo={undo}
                redo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                isEditing={isEditing}
                deleteDisabled={isPending || !isEditing}
                deleteDisabledReason={isPending ? PENDING_REASON : null}
                onRequestDelete={() => setArchiveOpen(true)}
                deleteAriaLabel={
                  isArchived ? 'Restore company' : 'Archive company'
                }
                deleteKind={isArchived ? 'restore' : 'archive'}
              />
            </Form>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={archiveOpen}
        title={isArchived ? 'Restore company?' : 'Archive company?'}
        description={
          isArchived
            ? `${company?.name ?? 'This company'} comes back to the Companies list.`
            : archiveCompanyDescription(
                company?.name,
                company?.clients[0]?.name
              )
        }
        confirmLabel={isArchived ? 'Restore' : 'Archive'}
        confirmVariant={isArchived ? 'default' : 'destructive'}
        confirmDisabled={isPending}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={handleArchiveToggle}
      />
      {unsavedChangesDialog}
    </>
  )
}

/** The People tab: the list, plus each person's portal access when billed. */
function CompanyPeopleTab(
  props: Omit<Parameters<typeof CompanyPeopleSection>[0], 'portalAccessFor'>
) {
  const portalAccessFor = useCompanyPortalAccess()
  return <CompanyPeopleSection {...props} portalAccessFor={portalAccessFor} />
}
