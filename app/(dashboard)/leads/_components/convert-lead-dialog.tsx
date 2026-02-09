'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Link2, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import {
  leadConversionSchema,
  type LeadConversionFormValues,
} from '@/lib/leads/conversion-schema'
import { convertLeadToClient } from '@/lib/leads/actions/convert-lead'
import type { LeadRecord } from '@/lib/leads/types'
import {
  fetchClientOptions,
  type ClientOption,
} from '../_actions/fetch-client-options'

type ConversionMode = 'create' | 'link'

interface ConvertLeadDialogProps {
  lead: LeadRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ConvertLeadDialog({
  lead,
  open,
  onOpenChange,
  onSuccess,
}: ConvertLeadDialogProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [isConverting, setIsConverting] = useState(false)
  const [mode, setMode] = useState<ConversionMode>('create')
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([])
  const [loadingClients, setLoadingClients] = useState(false)

  const form = useForm<LeadConversionFormValues>({
    resolver: zodResolver(leadConversionSchema),
    defaultValues: {
      leadId: lead.id,
      clientName: lead.companyName || lead.contactName,
      clientSlug: '',
      billingType: 'net_30',
      copyNotesToClient: true,
      createContact: !!lead.contactEmail,
      createProject: false,
      projectName: '',
      existingClientId: undefined,
      memberIds: [],
    },
  })

  // Load existing clients when switching to "link" mode
  const hasFetchedClients = useRef(false)
  useEffect(() => {
    if (mode === 'link' && !hasFetchedClients.current && !loadingClients) {
      hasFetchedClients.current = true
      setLoadingClients(true)
      fetchClientOptions()
        .then(setClientOptions)
        .catch(() => {
          toast({
            title: 'Failed to load clients',
            variant: 'destructive',
          })
        })
        .finally(() => setLoadingClients(false))
    }
  }, [mode, loadingClients, toast])

  const watchCreateProject = useWatch({ control: form.control, name: 'createProject' })
  const watchExistingClientId = useWatch({ control: form.control, name: 'existingClientId' })

  // Clear existingClientId when switching modes
  useEffect(() => {
    if (mode === 'create') {
      form.setValue('existingClientId', undefined)
    }
  }, [mode, form])

  async function onSubmit(values: LeadConversionFormValues) {
    setIsConverting(true)
    try {
      const result = await convertLeadToClient(values)

      if (result.error) {
        toast({
          title: 'Conversion failed',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      // Show warnings for partial failures (contact/project creation)
      if (result.warnings?.length) {
        for (const warning of result.warnings) {
          toast({
            title: 'Warning',
            description: warning,
            variant: 'destructive',
          })
        }
      }

      const parts = []
      if (mode === 'link') {
        parts.push('Lead linked to existing client')
      } else {
        parts.push(`Client "${values.clientName}" created`)
      }
      if (result.projectId) {
        parts.push('project created')
      }
      const description = parts.join(', ') + '.'

      toast({ title: 'Lead converted!', description })

      onOpenChange(false)
      onSuccess?.()

      if (result.clientSlug) {
        router.push(`/clients/${result.clientSlug}`)
      }
    } catch (error) {
      console.error('Lead conversion failed:', error)
      toast({
        title: 'Conversion failed',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Convert Lead to Client
          </DialogTitle>
          <DialogDescription>
            Create a new client or link to an existing one. Any linked email
            threads will be transferred to the client.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as ConversionMode)}
        >
          <TabsList className="w-full">
            <TabsTrigger value="create" className="flex-1 gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              New Client
            </TabsTrigger>
            <TabsTrigger value="link" className="flex-1 gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              Existing Client
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {mode === 'create' ? (
              <>
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder="Enter client name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientSlug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL Slug (optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder="auto-generated-if-empty"
                        />
                      </FormControl>
                      <FormDescription>
                        Leave blank to auto-generate from client name.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="billingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select billing type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="net_30">Net 30</SelectItem>
                          <SelectItem value="prepaid">Prepaid</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="copyNotesToClient"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Copy notes to client</FormLabel>
                        <FormDescription>
                          Transfer lead notes to the new client record.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <FormField
                control={form.control}
                name="existingClientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Client</FormLabel>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      disabled={loadingClients}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              loadingClients
                                ? 'Loading clients...'
                                : 'Choose a client'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientOptions.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {lead.contactEmail && (
              <FormField
                control={form.control}
                name="createContact"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Create contact record</FormLabel>
                      <FormDescription>
                        Create a contact for {lead.contactName} ({lead.contactEmail})
                        and link to the client.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="createProject"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Create a project</FormLabel>
                    <FormDescription>
                      Create an active project linked to the client.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {watchCreateProject && (
              <FormField
                control={form.control}
                name="projectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        placeholder={`Project for ${lead.companyName || lead.contactName}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isConverting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isConverting ||
                  (mode === 'link' && !watchExistingClientId)
                }
              >
                {isConverting
                  ? 'Converting...'
                  : mode === 'link'
                    ? 'Link to Client'
                    : 'Create Client'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
