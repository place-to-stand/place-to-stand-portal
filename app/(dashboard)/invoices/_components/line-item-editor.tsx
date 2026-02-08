'use client'

import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type LineItemFormData = {
  type: 'HOURS_PREPAID' | 'HOURS_WORKED' | 'CUSTOM'
  description: string
  quantity: string
  unitPrice: string
  amount: string
}

type LineItemEditorProps = {
  items: LineItemFormData[]
  onChange: (items: LineItemFormData[]) => void
  readOnly?: boolean
}

const TYPE_LABELS = {
  HOURS_PREPAID: 'Hours (Prepaid)',
  HOURS_WORKED: 'Hours (Worked)',
  CUSTOM: 'Custom',
} as const

function computeAmount(qty: string, price: string): string {
  const q = Number(qty)
  const p = Number(price)
  if (Number.isFinite(q) && Number.isFinite(p)) {
    return (q * p).toFixed(2)
  }
  return '0.00'
}

export function LineItemEditor({ items, onChange, readOnly }: LineItemEditorProps) {
  const addItem = () => {
    onChange([
      ...items,
      { type: 'CUSTOM', description: '', quantity: '1', unitPrice: '0', amount: '0.00' },
    ])
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof LineItemFormData, value: string) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item
      const next = { ...item, [field]: value }
      if (field === 'quantity' || field === 'unitPrice') {
        next.amount = computeAmount(
          field === 'quantity' ? value : next.quantity,
          field === 'unitPrice' ? value : next.unitPrice
        )
      }
      return next
    })
    onChange(updated)
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0)

  return (
    <div className='space-y-3'>
      <div className='space-y-2'>
        {items.map((item, index) => (
          <div key={index} className='flex items-start gap-2 rounded-lg border p-3'>
            <div className='grid flex-1 gap-2 sm:grid-cols-[140px_1fr_80px_100px_100px]'>
              <Select
                value={item.type}
                onValueChange={(v) => updateItem(index, 'type', v)}
                disabled={readOnly}
              >
                <SelectTrigger className='h-9 text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={item.description}
                onChange={(e) => updateItem(index, 'description', e.target.value)}
                placeholder='Description'
                className='h-9 text-sm'
                disabled={readOnly}
              />
              <Input
                value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                placeholder='Qty'
                type='number'
                step='any'
                className='h-9 text-sm'
                disabled={readOnly}
              />
              <Input
                value={item.unitPrice}
                onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                placeholder='Unit Price'
                type='number'
                step='0.01'
                className='h-9 text-sm'
                disabled={readOnly}
              />
              <div className='flex h-9 items-center justify-end text-sm font-medium tabular-nums'>
                ${Number(item.amount).toFixed(2)}
              </div>
            </div>
            {!readOnly && (
              <Button
                variant='ghost'
                size='icon'
                className='h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive'
                onClick={() => removeItem(index)}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <Button
          variant='outline'
          size='sm'
          onClick={addItem}
          className='w-full'
        >
          <Plus className='mr-1.5 h-4 w-4' />
          Add Line Item
        </Button>
      )}

      <div className='flex justify-end border-t pt-3'>
        <div className='text-sm'>
          <span className='text-muted-foreground'>Subtotal: </span>
          <span className='font-semibold tabular-nums'>${subtotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
