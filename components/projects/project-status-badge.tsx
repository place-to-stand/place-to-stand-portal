'use client'

import { Badge } from '@/components/ui/badge'
import {
  getProjectStatusLabel,
  getProjectStatusToken,
  type ProjectStatusValue,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

export type ProjectStatusBadgeProps = {
  status: ProjectStatusValue | string
  className?: string
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  const label = getProjectStatusLabel(status)
  const token = getProjectStatusToken(status)

  return (
    <Badge className={cn('text-xs', token, className)}>
      {label}
    </Badge>
  )
}
