'use client'

import { useState } from 'react'
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

import { Button } from '@/components/ui/button'

type PaymentFormProps = {
  total: string
  currency: string
  invoiceNumber: string | null
}

export function PaymentForm({ total, currency, invoiceNumber }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [succeeded, setSucceeded] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) return

    setProcessing(true)
    setError(null)

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    })

    if (result.error) {
      setError(result.error.message ?? 'Payment failed.')
      setProcessing(false)
    } else if (result.paymentIntent?.status === 'succeeded') {
      setSucceeded(true)
      setProcessing(false)
    } else {
      setProcessing(false)
    }
  }

  if (succeeded) {
    return (
      <div className='text-center space-y-2 py-4'>
        <p className='text-lg font-semibold text-green-600'>Payment Successful!</p>
        <p className='text-sm text-muted-foreground'>
          Thank you for your payment of ${Number(total).toFixed(2)} {currency}
          {invoiceNumber ? ` for invoice ${invoiceNumber}` : ''}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <PaymentElement />
      {error && (
        <p className='text-sm text-destructive'>{error}</p>
      )}
      <Button
        type='submit'
        disabled={!stripe || processing}
        className='w-full'
        size='lg'
      >
        {processing
          ? 'Processing...'
          : `Pay $${Number(total).toFixed(2)} ${currency}`}
      </Button>
    </form>
  )
}
