import type { ActivityLogWithActor } from '@/lib/activity/types'

import { isoTimestamp } from './timestamp'

export type CliActivity = {
  id: string
  occurredAt: string
  verb: string
  /** One human-readable line, e.g. `Moved task "X" from On deck to Done`. */
  summary: string
  /** Channel the change came through: ADMIN_UI, CLI, MCP or SYSTEM. */
  source: string
  /** The app that acted for the actor on an MCP write ("Claude Code"). */
  agent: string | null
  actor: { id: string; name: string | null; email: string } | null
  target: {
    type: string
    id: string | null
    projectId: string | null
    clientId: string | null
  }
}

/**
 * Deliberately compact: the summary already says what changed, so the raw
 * metadata (diffs, rich-text bodies) and the feed's display references are
 * left out to keep a page of activity small in a model's context.
 */
export function serializeActivity(log: ActivityLogWithActor): CliActivity {
  return {
    id: log.id,
    occurredAt: isoTimestamp(log.created_at),
    verb: log.verb,
    summary: log.summary,
    source: log.source,
    agent: agentName(log.metadata),
    actor: log.actor
      ? {
          id: log.actor.id,
          name: log.actor.full_name,
          email: log.actor.email,
        }
      : null,
    target: {
      type: log.target_type,
      id: log.target_id,
      projectId: log.target_project_id,
      clientId: log.target_client_id,
    },
  }
}

/** `metadata.agent` is stamped by the activity logger on MCP writes. */
function agentName(metadata: ActivityLogWithActor['metadata']): string | null {
  const agent = (metadata as { agent?: { name?: unknown } } | null)?.agent
  const name = agent?.name

  return typeof name === 'string' && name.trim() ? name : null
}
