'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HOUR_PRESETS, DEFAULT_HOURS } from '@/lib/invoices/constants'
import { createInvoiceAction } from '../_actions/create-invoice'
import { LineItemEditor, type LineItemFormData } from './line-item-editor'

type ClientOption = {
  id: string
  name: string
  billingType: string
}

type CreateInvoiceSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: ClientOption[]
  defaultHourlyRate: string
}

export function CreateInvoiceSheet({
  open,
  onOpenChange,
  clients,
  defaultHourlyRate,
}: CreateInvoiceSheetProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [clientId, setClientId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItemFormData[]>([])
  const [error, setError] = useState<string | null>(null)

  const selectedClient = clients.find(c => c.id === clientId)
  const isPrepaid = selectedClient?.billingType === 'prepaid'

  const handleClientChange = (id: string) => {
    setClientId(id)
    const client = clients.find(c => c.id === id)
    if (client?.billingType === 'prepaid' && lineItems.length === 0) {
      setLineItems([{
        type: 'HOURS_PREPAID',
        description: `${DEFAULT_HOURS} hours prepaid`,
        quantity: String(DEFAULT_HOURS),
        unitPrice: defaultHourlyRate,
        amount: (DEFAULT_HOURS * Number(defaultHourlyRate)).toFixed(2),
      }])
    }
  }

  const handlePresetClick = (hours: number) => {
    setLineItems([{
      type: 'HOURS_PREPAID',
      description: `${hours} hours prepaid`,
      quantity: String(hours),
      unitPrice: defaultHourlyRate,
      amount: (hours * Number(defaultHourlyRate)).toFixed(2),
    }])
  }

  const handleSubmit = () => {
    if (!clientId) {
      setError('Please select a client.')
      return
    }
    if (lineItems.length === 0) {
      setError('Add at least one line item.')
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await createInvoiceAction({
        clientId,
        dueDate: dueDate || null,
        notes: notes || null,
        lineItems,
      })

      if (result.success) {
        resetForm()
        onOpenChange(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Something went wrong.')
      }
    })
  }

  const resetForm = () => {
    setClientId('')
    setDueDate('')
    setNotes('')
    setLineItems([])
    setError(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>New Invoice</SheetTitle>
        </SheetHeader>

        <div className='mt-6 space-y-6'>
          {/* Client selection */}
          <div className='space-y-2'>
            <Label>Client</Label>
            <Select value={clientId} onValueChange={handleClientChange}>
              <SelectTrigger>
                <SelectValue placeholder='Select a client' />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due date */}
          <div className='space-y-2'>
            <Label>Due Date</Label>
            <Input
              type='date'
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Prepaid presets */}
          {isPrepaid && (
            <div className='space-y-2'>
              <Label>Quick Presets</Label>
              <div className='flex gap-2'>
                {HOUR_PRESETS.map(hours => (
                  <Button
                    key={hours}
                    variant='outline'
                    size='sm'
                    onClick={() => handlePresetClick(hours)}
                  >
                    {hours}h
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Line items */}
          <div className='space-y-2'>
            <Label>Line Items</Label>
            <LineItemEditor items={lineItems} onChange={setLineItems} />
          </div>

          {/* Notes */}
          <div className='space-y-2'>
            <Label>Notes (visible to client)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder='Payment terms, project details, etc.'
            />
          </div>

          {error && (
            <p className='text-sm text-destructive'>{error}</p>
          )}

          <div className='flex gap-3'>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className='flex-1'
            >
              {isPending ? 'Creating...' : 'Create Draft'}
            </Button>
            <Button
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
