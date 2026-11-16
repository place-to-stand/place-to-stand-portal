import { Badge } from '@pts/ui/badge'
import { BADGE_TINTS } from '@pts/ui/badge-tints'

/**
 * Marks work an AI app did for a person through the portal's MCP server:
 * "via Claude", "via ChatGPT". The name is the app's own OAuth client name,
 * so any connected app is labelled without a list of known apps.
 */
export function AgentBadge({ name }: { name: string }) {
  return (
    <Badge variant='outline' className={BADGE_TINTS.violet}>
      via {name}
    </Badge>
  )
}
