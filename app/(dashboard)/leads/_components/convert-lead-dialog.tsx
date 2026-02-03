'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'

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
import { useToast } from '@/components/ui/use-toast'
import {
  leadConversionSchema,
  type LeadConversionFormValues,
} from '@/lib/leads/conversion-schema'
import { convertLeadToClient } from '@/lib/leads/actions/convert-lead'
import type { LeadRecord } from '@/lib/leads/types'

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

  const form = useForm<LeadConversionFormValues>({
    resolver: zodResolver(leadConversionSchema),
    defaultValues: {
      leadId: lead.id,
      clientName: lead.companyName || lead.contactName,
      clientSlug: '',
      billingType: 'net_30',
      copyNotesToClient: true,
      memberIds: [],
    },
  })

  async function onSubmit(values: LeadConversionFormValues) {
    setIsConverting(true)
    const result = await convertLeadToClient(values)
    setIsConverting(false)

    if (result.error) {
      toast({
        title: 'Conversion failed',
        description: result.error,
        variant: 'destructive',
      })
      return
    }

    toast({
      title: 'Lead converted!',
      description: `Client "${values.clientName}" has been created.`,
    })

    onOpenChange(false)
    onSuccess?.()

    if (result.clientSlug) {
      router.push(`/clients/${result.clientSlug}`)
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
            Create a new client record from this lead. Any linked email threads
            will be transferred to the new client.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isConverting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isConverting}>
                {isConverting ? 'Converting...' : 'Convert to Client'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
