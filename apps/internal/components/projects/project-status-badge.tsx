import type { ReactNode } from 'react'

import { Badge } from '@pts/ui/badge'
import {
  getProjectStatusLabel,
  getProjectStatusToken,
  type ProjectStatusValue,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

/** A project's status as a colored badge, as on the Projects list. */
export function ProjectStatusBadge({
  status,
  className,
  children,
}: {
  status: ProjectStatusValue | string
  className?: string
  /** Shown after the label, e.g. a saving spinner. */
  children?: ReactNode
}) {
  return (
    <Badge
      variant='outline'
      className={cn('shrink-0', getProjectStatusToken(status), className)}
    >
      {getProjectStatusLabel(status)}
      {children}
    </Badge>
  )
}
