'use client'

import { CheckCircle, Mail, UserPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { LeadRecord } from '@/lib/leads/types'

import { PriorityBadge, ScoreBadge } from '../priority-badge'

type LeadSheetHeaderProps = {
  lead: LeadRecord
  canManage: boolean
  canConvert: boolean
  isConverted: boolean
  onSendEmail: () => void
  onConvertToClient: () => void
}

export function LeadSheetHeader({
  lead,
  canManage,
  canConvert,
  isConverted,
  onSendEmail,
  onConvertToClient,
}: LeadSheetHeaderProps) {
  const showHeader = lead.overallScore !== null || canConvert || isConverted

  if (!showHeader) return null

  return (
    <div className='mx-6 flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3'>
      <div className='flex items-center gap-3'>
        {lead.overallScore !== null && (
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground'>Score:</span>
            <ScoreBadge score={lead.overallScore} />
          </div>
        )}
        {lead.priorityTier && (
          <PriorityBadge tier={lead.priorityTier} showTooltip />
        )}
      </div>
      <div className='flex items-center gap-2'>
        {isConverted && (
          <Badge variant='outline' className='gap-1 bg-green-500/10 text-green-600 border-green-500/20'>
            <CheckCircle className='h-3 w-3' />
            Converted
          </Badge>
        )}
        {lead.contactEmail && canManage && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onSendEmail}
          >
            <Mail className='mr-2 h-4 w-4' />
            Send Email
          </Button>
        )}
        {canConvert && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onConvertToClient}
          >
            <UserPlus className='mr-2 h-4 w-4' />
            Convert to Client
          </Button>
        )}
      </div>
    </div>
  )
}
