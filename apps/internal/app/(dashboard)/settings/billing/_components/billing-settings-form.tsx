'use client'

import { useEffect } from 'react'
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

  // After a save the page reloads its rows (new ones now have real ids):
  // start the form again from them.
  const {
    products: savedProducts,
    taxRates: savedTaxRates,
    profitShare,
  } = props
  useEffect(() => {
    form.reset(
      defaultsFrom({
        products: savedProducts,
        taxRates: savedTaxRates,
        profitShare,
      })
    )
  }, [form, savedProducts, savedTaxRates, profitShare])

  const onSave = async (values: BillingSettingsValues) => {
    const result = await saveBillingSettings(values)
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
    form.reset(form.getValues())
    router.refresh()
    return true
  }

  return (
    <PageForm form={form} onSave={onSave} historyKey='billing-settings'>
      <div className={FORM_SECTIONS_CLASS}>
        <ProductCatalogSection
          items={products}
          savedItems={savedProducts}
          onItemsChange={next =>
            form.setValue('products', next, { shouldDirty: true })
          }
          disabled={disabled}
        />
        <TaxRatesSection
          rates={taxRates}
          savedRates={savedTaxRates}
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
