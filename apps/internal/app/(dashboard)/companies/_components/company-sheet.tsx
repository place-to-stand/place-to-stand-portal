'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'
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
import {
  CLIENT_LINK_OPTIONS_QUERY_KEY,
  useClientLinkOptions,
  type ClientLink,
} from '@/components/clients/client-link-picker'
import {
  CONTACT_OPTIONS_QUERY_KEY,
  useContactOptions,
  type ContactLink,
} from '@/components/contacts/contact-link-picker'
import { PENDING_REASON, getSubmitLabel } from '@/lib/forms/form-controls'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { subscribeSheetCreated } from '@/lib/sheets/created'

import {
  archiveCompany,
  loadCompanySheet,
  makeCompanyPrimaryContact,
  restoreCompany,
  saveCompany,
} from '../actions'
import { CompanyPeopleSection } from './company-people-section'
import {
  CompanyClientsSection,
  CompanyLeadsSection,
} from './company-sheet-sections'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'

const COMPANY_FORM_ID = 'company-form'

const companyFormSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(160),
  website: z.string().trim().max(255),
  linkedinUrl: z.string().trim().max(255),
  notes: z.string().max(20000),
  /** Set with the star on the People list; saved after the company itself. */
  primaryContactId: z.string().nullable(),
  /** People picked on the People list; they join (or move here) on Save. */
  addedContacts: z.array(
    z.object({ id: z.string(), name: z.string(), email: z.string().nullable() })
  ),
  /** People taken off the People list; they leave the company on Save. */
  removedContactIds: z.array(z.string()),
  /** Existing clients picked on the Clients list; linked here on Save. */
  addedClients: z.array(z.object({ id: z.string(), name: z.string() })),
})

type CompanyFormValues = z.infer<typeof companyFormSchema>

export const companySheetQueryKey = (companyId: string | null) =>
  ['companySheet', companyId] as const

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

  const { data, isLoading, isError } = useQuery({
    queryKey: companySheetQueryKey(companyId),
    queryFn: () => loadCompanySheet(companyId),
    staleTime: 0,
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
      addedClients: [],
    },
  })

  // Seed the form once per loaded record.
  const seededFor = useRef<string | null>(null)
  useEffect(() => {
    if (!data) return
    const key = company ? `${company.id}:${company.updatedAt}` : 'new'
    if (seededFor.current === key) return
    seededFor.current = key
    form.reset({
      name: company?.name ?? initialName ?? '',
      website: company?.website ?? '',
      linkedinUrl: company?.linkedinUrl ?? '',
      notes: company?.notes ?? '',
      primaryContactId: company?.primaryContactId ?? null,
      addedContacts: [],
      removedContactIds: [],
      addedClients: [],
    })
  }, [company, data, form, initialName])

  const isDirty = form.formState.isDirty
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
          addClientIds: values.addedClients.map(client => client.id),
        })

        if (!result.ok) {
          setFeedback(result.error ?? 'Unable to save the company.')
          return
        }

        if (
          companyId &&
          values.primaryContactId !== (company?.primaryContactId ?? null)
        ) {
          const primary = await makeCompanyPrimaryContact(
            companyId,
            values.primaryContactId
          )
          if (!primary.ok) {
            setFeedback(primary.error ?? 'Unable to set the primary contact.')
            await refresh()
            return
          }
        }

        if (!isEditing && result.id) {
          onCreated?.({ id: result.id, name: values.name.trim() })
        }
        toast({
          title: isEditing ? 'Company updated' : 'Company created',
          description: values.name,
        })
        form.reset(values)
        await refresh()
        // Save = done = close, for create and edit alike.
        onClose()
      })
    },
    [
      company?.primaryContactId,
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

  // The star on the People list is the one control for this field; it saves
  // with the form.
  const primaryContactId = useWatch({
    control: form.control,
    name: 'primaryContactId',
  })
  // A client's people and primary contact are admin-only (the server agrees).
  const { isAdmin } = useViewerAccess()
  const peopleLocked = !isAdmin && Boolean(company?.clients.length)
  const handleSetPrimary = useCallback(
    (contactId: string | null) =>
      form.setValue('primaryContactId', contactId, { shouldDirty: true }),
    [form]
  )

  const addedContacts = useWatch({
    control: form.control,
    name: 'addedContacts',
  })
  const removedContactIds = useWatch({
    control: form.control,
    name: 'removedContactIds',
  })
  const { data: contactOptions = [] } = useContactOptions()

  const handleAddPerson = useCallback(
    (contact: ContactLink) => {
      const removed = form.getValues('removedContactIds')
      if (removed.includes(contact.id)) {
        form.setValue(
          'removedContactIds',
          removed.filter(id => id !== contact.id),
          { shouldDirty: true }
        )
        return
      }
      const added = form.getValues('addedContacts')
      if (
        added.some(person => person.id === contact.id) ||
        company?.contacts.some(person => person.id === contact.id)
      ) {
        return
      }
      form.setValue(
        'addedContacts',
        [
          ...added,
          { id: contact.id, name: contact.name, email: contact.email },
        ],
        { shouldDirty: true }
      )
      // A contact just created on the stacked sheet isn't in the list yet.
      if (!contactOptions.some(option => option.id === contact.id)) {
        void queryClient.invalidateQueries({
          queryKey: CONTACT_OPTIONS_QUERY_KEY,
        })
      }
    },
    [company?.contacts, contactOptions, form, queryClient]
  )

  const handleRemovePerson = useCallback(
    (contactId: string) => {
      const added = form.getValues('addedContacts')
      if (added.some(person => person.id === contactId)) {
        form.setValue(
          'addedContacts',
          added.filter(person => person.id !== contactId),
          { shouldDirty: true }
        )
      } else {
        form.setValue(
          'removedContactIds',
          [...form.getValues('removedContactIds'), contactId],
          { shouldDirty: true }
        )
      }
      // Leaving the company gives up being its primary contact.
      if (form.getValues('primaryContactId') === contactId) {
        form.setValue('primaryContactId', null, { shouldDirty: true })
      }
    },
    [form]
  )

  const handleUndoRemovePerson = useCallback(
    (contactId: string) =>
      form.setValue(
        'removedContactIds',
        form.getValues('removedContactIds').filter(id => id !== contactId),
        { shouldDirty: true }
      ),
    [form]
  )

  const movesFrom = useCallback(
    (contactId: string) => {
      const option = contactOptions.find(contact => contact.id === contactId)
      return option?.companyId && option.companyId !== companyId
        ? (option.companyName ?? 'another company')
        : null
    },
    [companyId, contactOptions]
  )

  const addedClients = useWatch({ control: form.control, name: 'addedClients' })
  const { data: clientOptions = [] } = useClientLinkOptions(isAdmin)

  const handleAddClient = useCallback(
    (client: ClientLink) => {
      const added = form.getValues('addedClients')
      if (
        added.some(item => item.id === client.id) ||
        company?.clients.some(item => item.id === client.id)
      ) {
        return
      }
      form.setValue('addedClients', [...added, client], { shouldDirty: true })
    },
    [company?.clients, form]
  )

  const handleRemoveAddedClient = useCallback(
    (clientId: string) =>
      form.setValue(
        'addedClients',
        form.getValues('addedClients').filter(item => item.id !== clientId),
        { shouldDirty: true }
      ),
    [form]
  )

  const clientMovesFrom = useCallback(
    (clientId: string) => {
      const option = clientOptions.find(client => client.id === clientId)
      return option?.companyId && option.companyId !== companyId
        ? (option.companyName ?? 'another company')
        : null
    },
    [clientOptions, companyId]
  )

  // "Add client → Create new client" saves the client already linked here:
  // refresh the list, and drop the stage the picker made for it.
  useEffect(
    () =>
      subscribeSheetCreated('client', () => {
        void queryClient.invalidateQueries({
          queryKey: companySheetQueryKey(companyId),
        })
        void queryClient.invalidateQueries({
          queryKey: CLIENT_LINK_OPTIONS_QUERY_KEY,
        })
      }),
    [companyId, queryClient]
  )
  const linkedClientIds = company?.clients.map(client => client.id).join(',')
  useEffect(() => {
    if (!linkedClientIds) return
    const linked = new Set(linkedClientIds.split(','))
    const added = form.getValues('addedClients')
    const stillPending = added.filter(item => !linked.has(item.id))
    if (stillPending.length !== added.length) {
      form.setValue('addedClients', stillPending, { shouldDirty: true })
    }
  }, [form, linkedClientIds])

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
          size='lg'
          className='flex w-full flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader
            entity='company'
            title={isEditing ? 'Edit company' : 'Add company'}
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
                  onSubmit={form.handleSubmit(handleSubmit)}
                  className='flex flex-col gap-6 px-6 pt-6 pb-8'
                >
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

                  {company ? (
                    <>
                      <Separator />
                      <CompanyClientsSection
                        companyId={company.id}
                        clients={company.clients}
                        added={addedClients}
                        movesFrom={clientMovesFrom}
                        disabled={fieldsDisabled}
                        onAdd={handleAddClient}
                        onRemoveAdded={handleRemoveAddedClient}
                      />
                      <Separator />
                      <CompanyPeopleSection
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
                        onSetPrimary={handleSetPrimary}
                        onAdd={handleAddPerson}
                        onRemove={handleRemovePerson}
                        onUndoRemove={handleUndoRemovePerson}
                      />
                      <Separator />
                      <CompanyLeadsSection leads={company.leads} />
                    </>
                  ) : null}

                  <FormFeedback>{feedback}</FormFeedback>
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
            : `Archiving ${company?.name ?? 'this company'} hides it from the Companies list. Its contacts and leads stay as they are.`
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
