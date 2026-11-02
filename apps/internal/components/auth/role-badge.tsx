import { Badge } from '@pts/ui/badge'
import { BADGE_TINTS } from '@pts/ui/badge-tints'

import { ROLE_LABELS } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'

type Role = keyof typeof ROLE_LABELS

/** One tint per sign-in role, clear of the entity and billing colours. */
export const ROLE_BADGE_TINTS: Record<Role, string> = {
  ADMIN: BADGE_TINTS.violet,
  SALES: BADGE_TINTS.pink,
  CLIENT: BADGE_TINTS.cyan,
}

/**
 * A sign-in's role as a tinted badge. A sign-in that can't be used right now
 * (`off`: switched off by an admin; `archived`) shows grey, with the state
 * after the role: "Sales · off".
 */
export function RoleBadge({
  role,
  state,
  className,
}: {
  role: Role
  state?: 'off' | 'archived' | null
  className?: string
}) {
  return (
    <Badge
      variant='outline'
      className={cn(
        state ? BADGE_TINTS.neutral : ROLE_BADGE_TINTS[role],
        className
      )}
    >
      {ROLE_LABELS[role]}
      {state ? ` · ${state}` : ''}
    </Badge>
  )
}
