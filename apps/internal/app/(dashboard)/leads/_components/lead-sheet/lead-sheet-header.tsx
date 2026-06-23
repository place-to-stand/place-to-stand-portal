'use client'

import { CheckCircle, UserPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { LeadRecord } from '@/lib/leads/types'

type LeadSheetHeaderProps = {
  lead: LeadRecord
  canConvert: boolean
  isConverted: boolean
  onConvertToClient: () => void
}

export function LeadSheetHeader({
  canConvert,
  isConverted,
  onConvertToClient,
}: LeadSheetHeaderProps) {
  if (!canConvert && !isConverted) return null

  return (
    <div className='flex items-center justify-end py-2'>
      <div className='flex items-center gap-2'>
        {isConverted && (
          <Badge variant='outline' className='gap-1 bg-green-500/10 text-green-600 border-green-500/20'>
            <CheckCircle className='h-3 w-3' />
            Converted
          </Badge>
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
