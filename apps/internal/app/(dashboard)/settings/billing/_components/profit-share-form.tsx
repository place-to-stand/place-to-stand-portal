'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { PageForm } from '@/components/layout/page-form'
import { useToast } from '@/components/ui/use-toast'
import {
  profitShareSettingsSchema,
  type ProfitShareSettingsInput,
  type ProfitShareSettingsValues,
} from '@/lib/billing/profit-share-form'
import type { ProfitShareFormData } from '@/lib/billing/profit-share-query'

import { saveProfitShareSettings } from '../profit-share-actions'
import { ProfitShareFields } from './profit-share-fields'

/** Settings → Billing's Profit share: a page form with its own save bar. */
export function ProfitShareForm({ initial }: { initial: ProfitShareFormData }) {
  const router = useRouter()
  const { toast } = useToast()

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

  const onSave = async (values: ProfitShareSettingsValues) => {
    const result = await saveProfitShareSettings(values)
    if (!result.ok) {
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof ProfitShareSettingsInput, { message })
      }
      toast({
        variant: 'destructive',
        title: 'Unable to save the profit share',
        description: result.error,
      })
      return false
    }
    form.reset(form.getValues())
    router.refresh()
    return true
  }

  return (
    <PageForm form={form} onSave={onSave} historyKey='profit-share'>
      <div className='max-w-3xl'>
        <ProfitShareFields
          control={form.control}
          staff={initial.staff}
          savedPartnerIds={initial.profitSharePartnerIds}
          disabled={form.formState.isSubmitting}
        />
      </div>
    </PageForm>
  )
}
