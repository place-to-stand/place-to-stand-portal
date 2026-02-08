'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'

import { Button } from '@/components/ui/button'

import { PaymentForm } from './payment-form'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

type InvoiceClientProps = {
  shareToken: string
  total: string
  currency: string
  invoiceNumber: string | null
}

export function InvoiceClient({
  shareToken,
  total,
  currency,
  invoiceNumber,
}: InvoiceClientProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePayNow = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/public/invoices/${shareToken}/pay`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!data.ok) {
        setError(data.error ?? 'Failed to initialize payment.')
        return
      }

      setClientSecret(data.data.clientSecret)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!stripePromise) {
    return (
      <div className='rounded-lg border p-6 text-center'>
        <p className='text-sm text-muted-foreground'>
          Online payments are not configured. Please contact us to arrange payment.
        </p>
      </div>
    )
  }

  if (!clientSecret) {
    return (
      <div className='rounded-lg border p-6 text-center space-y-3'>
        <p className='text-sm text-muted-foreground'>
          Pay invoice {invoiceNumber ?? ''} — ${Number(total).toFixed(2)} {currency}
        </p>
        {error && <p className='text-sm text-destructive'>{error}</p>}
        <Button onClick={handlePayNow} disabled={loading} size='lg'>
          {loading ? 'Initializing...' : 'Pay Now'}
        </Button>
      </div>
    )
  }

  return (
    <div className='rounded-lg border p-6'>
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: 'stripe',
          },
        }}
      >
        <PaymentForm
          total={total}
          currency={currency}
          invoiceNumber={invoiceNumber}
        />
      </Elements>
    </div>
  )
}
