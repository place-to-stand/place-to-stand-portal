'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@pts/ui/button'
import { Input } from '@pts/ui/input'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import { useToast } from '@/components/ui/use-toast'
import type { BusinessImageChange } from '@/lib/business/settings-form'
import type { BusinessSettingsFormData } from '@/lib/business/settings-query'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'

import { saveBusinessSettings } from '../actions'
import {
  SECTIONS,
  textSchema,
  type TextInput,
  type TextOutput,
} from './business-form-fields'
import { BusinessImageField } from './business-image-field'
import { ProfitShareFields } from './profit-share-fields'
import { timeZoneOptions } from './time-zone-options'

const KEEP: BusinessImageChange = { kind: 'keep' }

function textDefaults(initial: BusinessSettingsFormData): TextInput {
  return {
    name: initial.name,
    legalName: initial.legalName,
    website: initial.website,
    addressLine1: initial.addressLine1,
    addressLine2: initial.addressLine2,
    city: initial.city,
    region: initial.region,
    postalCode: initial.postalCode,
    country: initial.country,
    phone: initial.phone,
    inboxEmail: initial.inboxEmail,
    sendingEmail: initial.sendingEmail,
    bookingUrl: initial.bookingUrl,
    timeZone: initial.timeZone,
    profitShareStartMonth: initial.profitShareStartMonth,
    profitShareMinimumBalance: initial.profitShareMinimumBalance,
    profitSharePartnerIds: initial.profitSharePartnerIds,
  }
}

export function BusinessSettingsForm({
  initial,
}: {
  initial: BusinessSettingsFormData
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [logo, setLogo] = useState<BusinessImageChange>(KEEP)
  const [icon, setIcon] = useState<BusinessImageChange>(KEEP)
  const [imageErrors, setImageErrors] = useState<{
    logo?: string
    icon?: string
  }>({})

  const form = useForm<TextInput, unknown, TextOutput>({
    resolver: zodResolver(textSchema),
    defaultValues: textDefaults(initial),
  })

  const zones = useMemo(
    () => timeZoneOptions(initial.timeZone),
    [initial.timeZone]
  )

  const isDirty =
    form.formState.isDirty || logo.kind !== 'keep' || icon.kind !== 'keep'
  const { dialog: discardDialog } = useUnsavedChangesWarning({ isDirty })

  const onSubmit = (values: TextOutput) => {
    startTransition(async () => {
      const result = await saveBusinessSettings({ ...values, logo, icon })
      if (!result.ok) {
        const {
          logo: logoError,
          icon: iconError,
          ...rest
        } = result.fieldErrors ?? {}
        for (const [name, message] of Object.entries(rest)) {
          form.setError(name as keyof TextInput, { message })
        }
        setImageErrors({ logo: logoError, icon: iconError })
        toast({
          variant: 'destructive',
          title: 'Unable to save business settings',
          description: result.error,
        })
        return
      }
      setImageErrors({})
      setLogo(KEEP)
      setIcon(KEEP)
      form.reset(form.getValues())
      toast({ title: 'Business settings saved' })
      router.refresh()
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={event => void form.handleSubmit(onSubmit)(event)}
        className='grid max-w-3xl gap-8'
      >
        {SECTIONS.map((section, index) => (
          <section key={section.title} className='grid gap-4'>
            <h2 className='text-lg font-semibold'>{section.title}</h2>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              {section.fields.map(field => (
                <FormField
                  key={field.name}
                  control={form.control}
                  name={field.name}
                  render={({ field: control }) => (
                    <FormItem
                      className={field.wide ? 'sm:col-span-2' : undefined}
                    >
                      <FormLabel optional={field.optional}>
                        {field.label}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...control}
                          value={control.value ?? ''}
                          type={field.type ?? 'text'}
                          autoComplete={field.autoComplete}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              {index === 0 ? (
                <>
                  <BusinessImageField
                    label='Logo'
                    shape='wide'
                    hint='Wide image up to 256 KB. PNG, JPEG, WEBP, or SVG.'
                    currentSrc={initial.logoSrc}
                    change={logo}
                    onChange={setLogo}
                    error={imageErrors.logo}
                    disabled={isPending}
                  />
                  <BusinessImageField
                    label='Icon'
                    shape='square'
                    hint='Square image up to 256 KB. PNG, JPEG, WEBP, or SVG.'
                    currentSrc={initial.iconSrc}
                    change={icon}
                    onChange={setIcon}
                    error={imageErrors.icon}
                    disabled={isPending}
                  />
                </>
              ) : null}
            </div>
          </section>
        ))}
        <section className='grid gap-4'>
          <h2 className='text-lg font-semibold'>Dates</h2>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='timeZone'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time zone</FormLabel>
                  <FormControl>
                    <SearchableCombobox
                      items={zones}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      searchPlaceholder='Search time zones...'
                      disabled={isPending}
                      ariaLabel='Time zone'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>
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
