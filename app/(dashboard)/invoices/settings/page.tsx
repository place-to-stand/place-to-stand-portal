'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { InvoicesTabsNav } from '../_components/invoices-tabs-nav'
import { updateBillingSettingsAction } from './_actions/update-billing-settings'

type BillingSettingsForm = {
  hourlyRate: string
  invoicePrefix: string
  companyName: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
  paymentTermsDays: string
}

export default function InvoiceSettingsPage() {
  // This page needs to be converted to a server component pattern
  // For now, we render a placeholder that loads on mount
  return <InvoiceSettingsClient />
}

function InvoiceSettingsClient() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  const [form, setForm] = useState<BillingSettingsForm>({
    hourlyRate: '200.00',
    invoicePrefix: 'PTS',
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    paymentTermsDays: '30',
  })

  const updateField = (field: keyof BillingSettingsForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = () => {
    setFeedback(null)
    startTransition(async () => {
      const result = await updateBillingSettingsAction({
        hourlyRate: form.hourlyRate,
        invoicePrefix: form.invoicePrefix,
        companyName: form.companyName || null,
        companyAddress: form.companyAddress || null,
        companyPhone: form.companyPhone || null,
        companyEmail: form.companyEmail || null,
        paymentTermsDays: Number(form.paymentTermsDays) || 30,
      })

      if (result.success) {
        setFeedback('Settings saved.')
        router.refresh()
      } else {
        setFeedback(result.error ?? 'Failed to save settings.')
      }
    })
  }

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Invoice Settings</h1>
          <p className='text-muted-foreground text-sm'>
            Configure billing defaults and company information for invoices.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        <InvoicesTabsNav activeTab='settings' />

        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <div className='max-w-lg space-y-6'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Default Hourly Rate ($)</Label>
                <Input
                  type='number'
                  step='0.01'
                  value={form.hourlyRate}
                  onChange={(e) => updateField('hourlyRate', e.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label>Invoice Prefix</Label>
                <Input
                  value={form.invoicePrefix}
                  onChange={(e) => updateField('invoicePrefix', e.target.value.toUpperCase())}
                  maxLength={10}
                  placeholder='PTS'
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label>Payment Terms (days)</Label>
              <Input
                type='number'
                value={form.paymentTermsDays}
                onChange={(e) => updateField('paymentTermsDays', e.target.value)}
                className='w-32'
              />
            </div>

            <div className='space-y-4'>
              <h3 className='text-sm font-medium'>Company Information</h3>
              <div className='space-y-2'>
                <Label>Company Name</Label>
                <Input
                  value={form.companyName}
                  onChange={(e) => updateField('companyName', e.target.value)}
                  placeholder='Place To Stand LLC'
                />
              </div>
              <div className='space-y-2'>
                <Label>Company Address</Label>
                <Textarea
                  value={form.companyAddress}
                  onChange={(e) => updateField('companyAddress', e.target.value)}
                  rows={3}
                  placeholder='123 Main St...'
                />
              </div>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label>Phone</Label>
                  <Input
                    value={form.companyPhone}
                    onChange={(e) => updateField('companyPhone', e.target.value)}
                    placeholder='+1 (555) 123-4567'
                  />
                </div>
                <div className='space-y-2'>
                  <Label>Email</Label>
                  <Input
                    type='email'
                    value={form.companyEmail}
                    onChange={(e) => updateField('companyEmail', e.target.value)}
                    placeholder='billing@example.com'
                  />
                </div>
              </div>
            </div>

            {feedback && (
              <p className={`text-sm ${feedback.includes('saved') ? 'text-green-600' : 'text-destructive'}`}>
                {feedback}
              </p>
            )}

            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </section>
      </div>
    </>
  )
}
