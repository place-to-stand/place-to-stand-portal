import type { ActivityLogWithActor } from '@/lib/activity/types'

export function getActorDisplayName(log: ActivityLogWithActor): string {
  return (
    log.actor?.full_name ||
    log.actor?.email ||
    (log.actor_role ? `${log.actor_role.toLowerCase()} user` : 'System')
  )
}

