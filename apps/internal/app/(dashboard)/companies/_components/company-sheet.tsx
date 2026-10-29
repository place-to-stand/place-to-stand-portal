'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { Input } from '@pts/ui/input'
import { Separator } from '@pts/ui/separator'
import { Skeleton } from '@pts/ui/skeleton'
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
import { PENDING_REASON } from '@/lib/forms/form-controls'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'

import {
  archiveCompany,
  loadCompanySheet,
  makeCompanyPrimaryContact,
  restoreCompany,
  saveCompany,
} from '../actions'
import {
  CompanyClientsSection,
  CompanyContactsSection,
  CompanyLeadsSection,
} from './company-sheet-sections'
import { EntityLinkPicker } from '@/components/ui/entity-link-picker'

const COMPANY_FORM_ID = 'company-form'

const companyFormSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(160),
  website: z.string().trim().max(255),
  linkedinUrl: z.string().trim().max(255),
  notes: z.string().max(20000),
  /** One of the company's people; saved after the company itself. */
  primaryContactId: z.string().nullable(),
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
    })
  }, [company, data, form, initialName])

  const isDirty = form.formState.isDirty
  const { requestConfirmation, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty })

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['companySheet'] }),
      queryClient.invalidateQueries({ queryKey: COMPANY_OPTIONS_QUERY_KEY }),
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
    [company?.primaryContactId, companyId, form, isEditing, onClose, onCreated, refresh, toast]
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

  // The star in the people list and the picker edit the same field, saved
  // with the form.
  const primaryContactId = useWatch({
    control: form.control,
    name: 'primaryContactId',
  })
  const handleSetPrimary = useCallback(
    (contactId: string | null) =>
      form.setValue('primaryContactId', contactId, { shouldDirty: true }),
    [form]
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
          size='lg'
          className='flex w-full flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader
            entity='company'
            title={isEditing ? (isArchived ? 'Archived company' : 'Edit company') : 'Add company'}
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
                    <div className='grid grid-cols-1 items-start gap-4 sm:grid-cols-2'>
                      <FormField
                        control={form.control}
                        name='website'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel optional>Website</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
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
                              <Input
                                {...field}
                                placeholder='linkedin.com/company/acme'
                                disabled={fieldsDisabled}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
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
                    {company ? (
                      <FormField
                        control={form.control}
                        name='primaryContactId'
                        render={({ field }) => {
                          const people = company.contacts.map(person => ({
                            id: person.id,
                            label: person.name,
                            description: person.jobTitle ?? person.email,
                          }))
                          return (
                            <FormItem>
                              <FormLabel optional>Primary contact</FormLabel>
                              <FormControl>
                                <EntityLinkPicker
                                  entity='contact'
                                  entityLabel='contact'
                                  aria-label='Primary contact'
                                  placeholder={
                                    people.length
                                      ? 'Select one of their people'
                                      : 'Set this company on a contact first'
                                  }
                                  value={
                                    people.find(person => person.id === field.value) ??
                                    null
                                  }
                                  onChange={next => field.onChange(next?.id ?? null)}
                                  options={people}
                                  disabled={fieldsDisabled || people.length === 0}
                                  toOption={record => ({ id: record.id, label: record.name })}
                                  createPrefillParam='contactName'
                                  allowCreate={false}
                                />
                              </FormControl>
                              <p className='text-muted-foreground text-xs'>
                                Clients use their company’s primary contact, e.g.
                                for invoice emails.
                              </p>
                              <FormMessage />
                            </FormItem>
                          )
                        }}
                      />
                    ) : null}
                  </SheetSection>

                  {company ? (
                    <>
                      <Separator />
                      <CompanyClientsSection clients={company.clients} />
                      <Separator />
                      <CompanyContactsSection
                        contacts={company.contacts}
                        primaryContactId={primaryContactId}
                        disabled={fieldsDisabled}
                        onSetPrimary={handleSetPrimary}
                      />
                      <Separator />
                      <CompanyLeadsSection leads={company.leads} />
                    </>
                  ) : null}

                  {feedback ? (
                    <p className='border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'>
                      {feedback}
                    </p>
                  ) : null}
                </form>
              </div>
              <SheetFormFooter
                formId={COMPANY_FORM_ID}
                saveLabel={
                  isPending ? 'Saving...' : isEditing ? 'Save changes' : 'Create company'
                }
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
                deleteAriaLabel={isArchived ? 'Restore company' : 'Archive company'}
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
