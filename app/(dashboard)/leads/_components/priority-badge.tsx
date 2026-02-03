'use client'

import { Flame, Snowflake, Thermometer } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { PriorityTier } from '@/lib/leads/intelligence-types'
import { cn } from '@/lib/utils'

const priorityConfig = {
  hot: {
    icon: Flame,
    label: 'Hot',
    className: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
    description: 'High engagement and strong buying signals',
  },
  warm: {
    icon: Thermometer,
    label: 'Warm',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
    description: 'Moderate engagement, showing interest',
  },
  cold: {
    icon: Snowflake,
    label: 'Cold',
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
    description: 'Low engagement or going stale',
  },
} as const

type PriorityBadgeProps = {
  tier: PriorityTier
  showTooltip?: boolean
  className?: string
}

export function PriorityBadge({
  tier,
  showTooltip = true,
  className,
}: PriorityBadgeProps) {
  const config = priorityConfig[tier]
  const Icon = config.icon

  const badge = (
    <Badge
      variant="outline"
      className={cn('gap-1 text-[10px] font-medium', config.className, className)}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {config.label}
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-48 text-center">
        {config.description}
      </TooltipContent>
    </Tooltip>
  )
}

type ScoreBadgeProps = {
  score: number | null
  className?: string
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  if (score === null) return null

  const scoreClass =
    score >= 70
      ? 'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400'
      : score >= 40
        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
        : 'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400'

  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] font-mono font-medium tabular-nums', scoreClass, className)}
    >
      {Math.round(score)}
    </Badge>
  )
}
