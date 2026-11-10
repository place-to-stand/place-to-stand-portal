import 'server-only'

import { createHmac } from 'node:crypto'

import { serverEnv } from '@/lib/env.server'

/**
 * The secret that names sheet presence channels. Realtime channels are open
 * to anyone holding the public anon key (client-portal users included), so
 * a channel named after a record id would let them see who has it open.
 * Each channel is instead named by an HMAC of the record under this key,
 * which only signed-in staff receive. Derived, so there is nothing to set.
 */
export function presenceRoomKey(): string {
  return createHmac('sha256', serverEnv.SUPABASE_SERVICE_ROLE_KEY)
    .update('sheet-presence:v1')
    .digest('base64url')
}
