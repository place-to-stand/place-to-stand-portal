'use client'

import { CircleDashed, CheckCircle2, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ThreadClassification } from '@/lib/types/messages'

const config: Record<ThreadClassification, {
  label: string
  icon: typeof CircleDashed
  className: string
}> = {
  UNCLASSIFIED: {
    label: 'Unclassified',
    icon: CircleDashed,
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  CLASSIFIED: {
    label: 'Classified',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  DISMISSED: {
    label: 'Dismissed',
    icon: XCircle,
    className: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
  },
}

interface ClassificationBadgeProps {
  classification: ThreadClassification
  className?: string
}

export function ClassificationBadge({ classification, className }: ClassificationBadgeProps) {
  const { label, icon: Icon, className: badgeClassName } = config[classification]

  return (
    <Badge
      variant='secondary'
      className={cn('gap-1 border-0 text-xs font-medium', badgeClassName, className)}
    >
      <Icon className='h-3 w-3' />
      {label}
    </Badge>
  )
}
