'use client'

import { AlertTriangle, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type GmailReconnectBannerProps = {
  status: 'EXPIRED' | 'REVOKED' | 'PENDING_REAUTH'
  errorMessage?: string | null
}

export function GmailReconnectBanner({ status, errorMessage }: GmailReconnectBannerProps) {
  const statusMessages = {
    EXPIRED: {
      title: 'Gmail Connection Expired',
      description: 'Your Gmail access has expired. Please reconnect to continue syncing emails.',
    },
    REVOKED: {
      title: 'Gmail Access Revoked',
      description: 'Your Gmail access was revoked. Please reconnect to continue syncing emails.',
    },
    PENDING_REAUTH: {
      title: 'Gmail Reconnection Required',
      description: 'Your Gmail connection needs to be refreshed. Please reconnect to continue syncing emails.',
    },
  }

  const { title, description } = statusMessages[status]

  return (
    <Alert variant='destructive' className='mb-4'>
      <AlertTriangle className='h-4 w-4' />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className='mt-2 flex flex-col gap-3'>
        <p>{description}</p>
        {errorMessage && (
          <p className='text-xs opacity-80'>
            Details: {errorMessage}
          </p>
        )}
        <Button
          variant='outline'
          size='sm'
          className='w-fit'
          asChild
        >
          <a href='/settings/integrations'>
            <ExternalLink className='h-4 w-4' />
            Reconnect Gmail
          </a>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
