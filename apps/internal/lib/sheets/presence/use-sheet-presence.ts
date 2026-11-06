'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import type { SheetEntityKey } from '@/lib/sheets/entities'
import type { SaveConflictGuard } from '@/lib/sheets/save-conflict/use-save-conflict'
import { versionMs } from '@/lib/sheets/save-conflict/types'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

/** Someone else with the same record's sheet open. */
export type SheetViewer = {
  userId: string
  name: string
  hasPhoto: boolean
  /** They have unsaved edits. */
  editing: boolean
}

/** A save someone else made while this sheet was open. */
export type TheirSave = {
  userId: string
  name: string
  /** The viewer's own save, from another tab. */
  mine: boolean
  version: string
}

type PresencePayload = Omit<SheetViewer, 'editing'> & { editing: boolean }

type UseSheetPresenceArgs = {
  entity: SheetEntityKey
  /** Null on a create sheet: no one else can be on a record not yet made. */
  recordId: string | null
  open: boolean
  isDirty: boolean
  guard: SaveConflictGuard
}

/**
 * Who else has this record's sheet open, and their saves as they happen,
 * over a Supabase Realtime channel per record. Nothing is locked or stored:
 * presence lives only as long as each tab's connection, so a closed tab
 * or a dropped laptop leaves within seconds and nobody is ever stuck
 * showing as here. If Realtime is down the sheet works as before; the
 * save check on the server is what keeps data safe.
 */
export function useSheetPresence({
  entity,
  recordId,
  open,
  isDirty,
  guard,
}: UseSheetPresenceArgs) {
  const { userId, name, hasPhoto, presenceKey } = useViewerAccess()
  const [others, setOthers] = useState<SheetViewer[]>([])
  const [theirSave, setTheirSave] = useState<TheirSave | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const meRef = useRef<PresencePayload | null>(null)
  const guardRef = useRef(guard)
  const isDirtyRef = useRef(isDirty)
  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    guardRef.current = guard
  }, [guard])

  const active = open && Boolean(recordId) && Boolean(userId)

  // Join while the sheet is open on a saved record; leave on close.
  useEffect(() => {
    if (!active || !recordId || !userId || !presenceKey) return
    const me: PresencePayload = {
      userId,
      name: name ?? 'Someone',
      hasPhoto,
      editing: isDirtyRef.current,
    }
    meRef.current = me
    const supabase = getSupabaseBrowserClient()
    let channel: RealtimeChannel | null = null
    let closed = false

    const join = async () => {
      const topic = await presenceTopic(presenceKey, entity, recordId)
      // A channel for this record still leaving (the sheet closed and
      // reopened quickly) would be handed back and never rejoin: wait
      // for it to go first.
      await Promise.all(
        supabase
          .getChannels()
          .filter(stale => stale.subTopic === topic)
          .map(stale => supabase.removeChannel(stale))
      )
      if (closed) return
      const joined = supabase.channel(topic, {
        config: { presence: { key: userId }, broadcast: { self: false } },
      })
      channel = joined
      channelRef.current = joined

      joined
        .on('presence', { event: 'sync' }, () => {
          const state = joined.presenceState<PresencePayload>()
          const seen = new Map<string, SheetViewer>()
          for (const [key, entries] of Object.entries(state)) {
            if (key === userId) continue
            // One person in two tabs shows once; editing in either counts.
            for (const entry of entries) {
              const prior = seen.get(key)
              seen.set(key, {
                userId: entry.userId,
                name: entry.name,
                hasPhoto: entry.hasPhoto,
                editing: Boolean(prior?.editing || entry.editing),
              })
            }
          }
          setOthers([...seen.values()])
        })
        // `self: false` already drops this tab's own sends; a save from the
        // viewer's other tab still counts.
        .on('broadcast', { event: 'saved' }, ({ payload }) => {
          const saved = payload as Partial<TheirSave>
          if (!saved.version || !saved.userId) return
          // Already holding that version (or newer): nothing to say.
          const held = guardRef.current.expected()
          if (held && versionMs(held) >= versionMs(saved.version)) return
          setTheirSave({
            userId: saved.userId,
            name: saved.name ?? 'Someone',
            mine: saved.userId === userId,
            version: saved.version,
          })
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED' && meRef.current) {
            void joined.track(meRef.current)
          }
        })
    }
    // Presence is a nicety: if joining fails (no Web Crypto on plain
    // http, Realtime down), the sheet works as before.
    join().catch(() => {})

    return () => {
      closed = true
      channelRef.current = null
      setOthers([])
      setTheirSave(null)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [active, entity, recordId, userId, name, hasPhoto, presenceKey])

  // Others see "editing" once this sheet has unsaved edits.
  useEffect(() => {
    const me = meRef.current
    if (!me || me.editing === isDirty) return
    // Kept even before the channel joins: joining tracks the latest.
    meRef.current = { ...me, editing: isDirty }
    void channelRef.current?.track(meRef.current)
  }, [isDirty, active])

  // This sheet's own saves go out to everyone else on the record.
  useEffect(() => {
    if (!active) return
    return guard.onSaved(version => {
      // Holding their save's version now (or newer): the note is done.
      setTheirSave(null)
      void channelRef.current?.send({
        type: 'broadcast',
        event: 'saved',
        payload: { userId, name: name ?? 'Someone', version },
      })
    })
  }, [active, guard, name, userId])

  return {
    others,
    theirSave,
    clearTheirSave: () => setTheirSave(null),
  }
}

/**
 * The record's channel name: an HMAC of it under the staff-only room key,
 * so nobody without the key can find (or join) the channel.
 */
async function presenceTopic(
  roomKey: string,
  entity: SheetEntityKey,
  recordId: string
): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(roomKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${entity}:${recordId}`)
  )
  const hex = Array.from(new Uint8Array(mac), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('')
  return `sheet:${hex}`
}
