'use client'

import { Mail, Calendar, FileText, RefreshCw, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'

type LeadActionsPanelProps = {
  canManage: boolean
  canConvert: boolean
  isConverted: boolean
  onSendEmail: () => void
  onScheduleMeeting: () => void
  onBuildProposal: () => void
  onConvertToClient: () => void
  onRescore?: () => void
  isRescoring?: boolean
}

export function LeadActionsPanel({
  canManage,
  canConvert,
  isConverted,
  onSendEmail,
  onScheduleMeeting,
  onBuildProposal,
  onConvertToClient,
  onRescore,
  isRescoring = false,
}: LeadActionsPanelProps) {
  if (!canManage) return null

  return (
    <div className='space-y-3'>
      <span className='text-sm font-medium'>Quick Actions</span>
      <div className='grid grid-cols-2 gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-auto justify-start gap-2 py-2'
          onClick={onSendEmail}
        >
          <Mail className='h-4 w-4 text-blue-500' />
          <span className='text-xs'>Send Email</span>
        </Button>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-auto justify-start gap-2 py-2'
          onClick={onScheduleMeeting}
        >
          <Calendar className='h-4 w-4 text-green-500' />
          <span className='text-xs'>Schedule</span>
        </Button>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-auto justify-start gap-2 py-2'
          onClick={onBuildProposal}
        >
          <FileText className='h-4 w-4 text-amber-500' />
          <span className='text-xs'>Proposal</span>
        </Button>
        {onRescore && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-auto justify-start gap-2 py-2'
            onClick={onRescore}
            disabled={isRescoring}
          >
            <RefreshCw
              className={`h-4 w-4 text-purple-500 ${isRescoring ? 'animate-spin' : ''}`}
            />
            <span className='text-xs'>Rescore</span>
          </Button>
        )}
      </div>
      {canConvert && !isConverted && (
        <Button
          type='button'
          variant='default'
          size='sm'
          className='mt-2 w-full'
          onClick={onConvertToClient}
        >
          <UserPlus className='mr-2 h-4 w-4' />
          Convert to Client
        </Button>
      )}
    </div>
  )
}
