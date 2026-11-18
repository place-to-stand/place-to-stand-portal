'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Input } from '@pts/ui/input'

import {
  FORM_FIELD_WIDE_CLASS,
  FORM_SECTIONS_CLASS,
  FormSection,
} from '@/components/forms/form-section'
import { PageForm } from '@/components/layout/page-form'

import {
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

import { saveBusinessSettings } from '../actions'
import {
  SECTIONS,
  textSchema,
  type TextInput,
  type TextOutput,
} from './business-form-fields'
import { BusinessImageField } from './business-image-field'
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
  }
}

export function BusinessSettingsForm({
  initial,
}: {
  initial: BusinessSettingsFormData
}) {
  const router = useRouter()
  const { toast } = useToast()
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

  const isPending = form.formState.isSubmitting

  const onSave = async (values: TextOutput) => {
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
      return false
    }
    setImageErrors({})
    setLogo(KEEP)
    setIcon(KEEP)
    form.reset(form.getValues())
    router.refresh()
    return true
  }

  return (
    <PageForm
      form={form}
      onSave={onSave}
      historyKey='business-settings'
      externalDirty={logo.kind !== 'keep' || icon.kind !== 'keep'}
      getExternalState={() => ({ logo, icon })}
      applyExternalState={state => {
        const images = state as {
          logo: BusinessImageChange
          icon: BusinessImageChange
        }
        setLogo(images.logo)
        setIcon(images.icon)
      }}
      onDiscard={() => {
        setLogo(KEEP)
        setIcon(KEEP)
        setImageErrors({})
      }}
      // Until the details are confirmed once, Save shows with nothing changed.
      alwaysShowBar={!initial.confirmedAt}
    >
      <div className={`${FORM_SECTIONS_CLASS} max-w-3xl`}>
        {SECTIONS.map((section, index) => (
          <FormSection key={section.title} title={section.title}>
            {section.fields.map(field => (
              <FormField
                key={field.name}
                control={form.control}
                name={field.name}
                render={({ field: control }) => (
                  <FormItem
                    className={field.wide ? FORM_FIELD_WIDE_CLASS : undefined}
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
                  hint='Wide image up to 256 KB. PNG, JPEG, WEBP or SVG.'
                  currentSrc={initial.logoSrc}
                  change={logo}
                  onChange={setLogo}
                  error={imageErrors.logo}
                  disabled={isPending}
                />
                <BusinessImageField
                  label='Icon'
                  shape='square'
                  hint='Square image up to 256 KB. PNG, JPEG, WEBP or SVG.'
                  currentSrc={initial.iconSrc}
                  change={icon}
                  onChange={setIcon}
                  error={imageErrors.icon}
                  disabled={isPending}
                />
              </>
            ) : null}
          </FormSection>
        ))}
        <FormSection title='Dates'>
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
        </FormSection>
      </div>
    </PageForm>
  )
}
