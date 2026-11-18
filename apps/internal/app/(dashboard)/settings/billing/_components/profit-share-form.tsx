'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@pts/ui/button'

import { Form } from '@/components/ui/form'
import { useToast } from '@/components/ui/use-toast'
import {
  profitShareSettingsSchema,
  type ProfitShareSettingsInput,
  type ProfitShareSettingsValues,
} from '@/lib/billing/profit-share-form'
import type { ProfitShareFormData } from '@/lib/billing/profit-share-query'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'

import { saveProfitShareSettings } from '../profit-share-actions'
import { ProfitShareFields } from './profit-share-fields'

/** Settings → Billing's Profit share: its own form, saved by its own Save. */
export function ProfitShareForm({ initial }: { initial: ProfitShareFormData }) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const form = useForm<
    ProfitShareSettingsInput,
    unknown,
    ProfitShareSettingsValues
  >({
    resolver: zodResolver(profitShareSettingsSchema),
    defaultValues: {
      profitShareStartMonth: initial.profitShareStartMonth,
      profitShareMinimumBalance: initial.profitShareMinimumBalance,
      profitSharePartnerIds: initial.profitSharePartnerIds,
    },
  })
  const { dialog: discardDialog } = useUnsavedChangesWarning({
    isDirty: form.formState.isDirty,
  })

  const onSubmit = (values: ProfitShareSettingsValues) => {
    startTransition(async () => {
      const result = await saveProfitShareSettings(values)
      if (!result.ok) {
        for (const [name, message] of Object.entries(
          result.fieldErrors ?? {}
        )) {
          form.setError(name as keyof ProfitShareSettingsInput, { message })
        }
        toast({
          variant: 'destructive',
          title: 'Unable to save the profit share',
          description: result.error,
        })
        return
      }
      form.reset(form.getValues())
      toast({ title: 'Profit share saved' })
      router.refresh()
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={event => void form.handleSubmit(onSubmit)(event)}
        className='flex max-w-3xl flex-col gap-4'
      >
        <ProfitShareFields
          control={form.control}
          staff={initial.staff}
          savedPartnerIds={initial.profitSharePartnerIds}
          disabled={isPending}
        />
        <div>
          <Button type='submit' disabled={isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
      {discardDialog}
    </Form>
  )
}
