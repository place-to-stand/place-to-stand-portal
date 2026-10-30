'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Checkbox } from '@pts/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@pts/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { useToast } from '@/components/ui/use-toast'
import {
  leadConversionSchema,
  type LeadConversionFormValues,
} from '@/lib/leads/conversion-schema'
import { convertLeadToClient } from '@/lib/leads/actions/convert-lead'
import type { LeadRecord } from '@/lib/leads/types'
import {
  fetchCompanyClient,
  type ClientOption,
} from '../_actions/fetch-client-options'

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
  // The lead's company may already be a client: then the lead links to it.
  // undefined = still checking.
  const [companyClient, setCompanyClient] = useState<
    ClientOption | null | undefined
  >(lead.companyId ? undefined : null)
  const companyName = lead.companyName || lead.contactName

  const form = useForm<LeadConversionFormValues>({
    resolver: zodResolver(leadConversionSchema),
    defaultValues: {
      leadId: lead.id,
      clientName: lead.companyName || lead.contactName,
      clientSlug: '',
      // New clients usually start on prepaid hours.
      billingType: 'prepaid',
      copyNotesToClient: true,
      givePortalAccess: false,
      createProject: false,
      projectName: '',
      existingClientId: undefined,
    },
  })

  useEffect(() => {
    if (!open || !lead.companyId) return
    let cancelled = false
    fetchCompanyClient(lead.companyId)
      .then(client => {
        if (!cancelled) setCompanyClient(client)
      })
      .catch(() => {
        if (!cancelled) setCompanyClient(null)
      })
    return () => {
      cancelled = true
    }
  }, [lead.companyId, open])
  const isLinking = Boolean(companyClient)

  const watchCreateProject = useWatch({
    control: form.control,
    name: 'createProject',
  })
  async function onSubmit(values: LeadConversionFormValues) {
    setIsConverting(true)
    try {
      const result = await convertLeadToClient(values)

      if (result.error) {
        toast({
          title: 'Unable to make client',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      // Show warnings for partial failures (contact/project creation)
      if (result.warnings?.length) {
        for (const warning of result.warnings) {
          toast({
            title: 'Lead converted with warnings',
            description: warning,
            variant: 'destructive',
          })
        }
      }

      const parts = []
      if (isLinking) {
        parts.push(`Lead linked to ${companyName}, already a client`)
      } else {
        parts.push(`${companyName} is now a client`)
      }
      if (result.projectId) {
        parts.push('project created')
      }
      const description = parts.join(', ') + '.'

      toast({ title: 'Client made', description })

      onOpenChange(false)
      onSuccess?.()

      if (result.clientSlug) {
        router.push(`/clients/${result.clientSlug}`)
      }
    } catch (error) {
      console.error('Lead conversion failed:', error)
      toast({
        title: 'Unable to make client',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-[480px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Building2 className='h-5 w-5' />
            Make client
          </DialogTitle>
          <DialogDescription>
            {companyClient === undefined
              ? `Checking ${companyName}…`
              : isLinking
                ? `${companyName} is already a client, so this lead is linked to it.`
                : `${companyName} becomes a client: its billing is set up on the company.`}{' '}
            Any linked email threads move to the client.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            {isLinking ? null : (
              <>
                <FormField
                  control={form.control}
                  name='billingType'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select billing type' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='net_30'>Net 30</SelectItem>
                          <SelectItem value='prepaid'>Prepaid</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='copyNotesToClient'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4'>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className='space-y-1 leading-none'>
                        <FormLabel>Copy notes to client</FormLabel>
                        <FormDescription>
                          Transfer lead notes to the new client.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </>
            )}

            {
              <FormField
                control={form.control}
                name='givePortalAccess'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4'>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className='space-y-1 leading-none'>
                      <FormLabel>Give portal access</FormLabel>
                      <FormDescription>
                        {lead.contactName} joins {companyName} either way. Tick
                        to also let them see it in the client portal (they need
                        a sign-in).
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            }

            <FormField
              control={form.control}
              name='createProject'
              render={({ field }) => (
                <FormItem className='flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4'>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className='space-y-1 leading-none'>
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
                name='projectName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project name</FormLabel>
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
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isConverting}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={isConverting || companyClient === undefined}
              >
                {isConverting
                  ? 'Saving…'
                  : isLinking
                    ? 'Link to client'
                    : 'Make client'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
