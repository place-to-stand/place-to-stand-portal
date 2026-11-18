'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { FORM_SECTIONS_CLASS } from '@/components/forms/form-section'
import { PageForm } from '@/components/layout/page-form'
import { useToast } from '@/components/ui/use-toast'
import {
  billingSettingsSchema,
  type BillingSettingsInput,
  type BillingSettingsValues,
} from '@/lib/billing/billing-settings-form'
import type { ProfitShareSettingsInput } from '@/lib/billing/profit-share-form'
import type { ProfitShareFormData } from '@/lib/billing/profit-share-query'
import type { ProductCatalogItemRow } from '@/lib/queries/product-catalog'
import type { TaxRateRow } from '@/lib/queries/tax-rates'

import { saveBillingSettings } from '../actions'
import { ProductCatalogSection } from './product-catalog-section'
import { ProfitShareFields } from './profit-share-fields'
import { TaxRatesSection } from './tax-rates-section'

type BillingSettingsFormProps = {
  products: ProductCatalogItemRow[]
  taxRates: TaxRateRow[]
  profitShare: ProfitShareFormData
}

function defaultsFrom({
  products,
  taxRates,
  profitShare,
}: BillingSettingsFormProps): BillingSettingsInput {
  return {
    products,
    taxRates,
    profitShareStartMonth: profitShare.profitShareStartMonth,
    profitShareMinimumBalance: profitShare.profitShareMinimumBalance,
    profitSharePartnerIds: profitShare.profitSharePartnerIds,
  }
}

/** The page as last saved: the rows' marks and Save's comparison start here. */
function savedFrom({
  products,
  taxRates,
  profitShare,
}: BillingSettingsFormProps): {
  products: ProductCatalogItemRow[]
  taxRates: TaxRateRow[]
  profitShare: ProfitShareSettingsInput
} {
  return {
    products,
    taxRates,
    profitShare: {
      profitShareStartMonth: profitShare.profitShareStartMonth,
      profitShareMinimumBalance: profitShare.profitShareMinimumBalance,
      profitSharePartnerIds: profitShare.profitSharePartnerIds,
    },
  }
}

/**
 * Settings → Billing as one page form: products, tax rates and the profit
 * share all change the form, and the save bar's Save writes them together
 * (`saveBillingSettings`, one transaction). Undo, Redo and Discard cover
 * every row.
 */
export function BillingSettingsForm(props: BillingSettingsFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  const form = useForm<BillingSettingsInput, unknown, BillingSettingsValues>({
    resolver: zodResolver(billingSettingsSchema),
    defaultValues: defaultsFrom(props),
  })
  const products = useWatch({ control: form.control, name: 'products' })
  const taxRates = useWatch({ control: form.control, name: 'taxRates' })
  const disabled = form.formState.isSubmitting

  // The rows as last saved: the "New" / "Edited" marks compare against them.
  // A save sets them from its result; fresh server data sets them only while
  // there are no unsaved edits, so a refresh never wipes work in progress.
  const [saved, setSaved] = useState(() => savedFrom(props))
  const { profitShare } = props
  const serverKey = JSON.stringify([
    props.products,
    props.taxRates,
    profitShare,
  ])
  // New server data (after a save, or another refresh): adopt it as the
  // saved rows, unless there are unsaved edits it would overwrite.
  const [seenKey, setSeenKey] = useState(serverKey)
  if (seenKey !== serverKey) {
    setSeenKey(serverKey)
    if (!form.formState.isDirty) setSaved(savedFrom(props))
  }
  const resetKey = useRef(serverKey)
  useEffect(() => {
    if (resetKey.current === serverKey) return
    resetKey.current = serverKey
    if (form.formState.isDirty) return
    form.reset(defaultsFrom(props))
  }, [form, props, serverKey])

  const onSave = async (values: BillingSettingsValues) => {
    // What the page started from, so the server writes only what changed here
    // and refuses a row someone else saved in the meantime.
    const result = await saveBillingSettings({
      ...values,
      productBases: Object.fromEntries(saved.products.map(p => [p.id, p])),
      taxRateBases: Object.fromEntries(saved.taxRates.map(r => [r.id, r])),
      profitShareBase: saved.profitShare,
    })
    if (!result.ok) {
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof BillingSettingsInput, { message })
      }
      toast({
        variant: 'destructive',
        title: 'Unable to save billing settings',
        description: result.error,
      })
      return false
    }
    setSaved({
      products: result.products,
      taxRates: result.taxRates,
      profitShare: {
        profitShareStartMonth: values.profitShareStartMonth,
        profitShareMinimumBalance: values.profitShareMinimumBalance,
        profitSharePartnerIds: values.profitSharePartnerIds,
      },
    })
    form.reset({
      ...form.getValues(),
      products: result.products,
      taxRates: result.taxRates,
    })
    router.refresh()
    return true
  }

  return (
    <PageForm form={form} onSave={onSave} historyKey='billing-settings'>
      <div className={FORM_SECTIONS_CLASS}>
        <ProductCatalogSection
          items={products}
          savedItems={saved.products}
          onItemsChange={next =>
            form.setValue('products', next, { shouldDirty: true })
          }
          disabled={disabled}
        />
        <TaxRatesSection
          rates={taxRates}
          savedRates={saved.taxRates}
          onRatesChange={next =>
            form.setValue('taxRates', next, { shouldDirty: true })
          }
          disabled={disabled}
        />
        <div className='max-w-3xl'>
          <ProfitShareFields
            control={form.control}
            staff={profitShare.staff}
            savedPartnerIds={profitShare.profitSharePartnerIds}
            disabled={disabled}
          />
        </div>
      </div>
    </PageForm>
  )
}
