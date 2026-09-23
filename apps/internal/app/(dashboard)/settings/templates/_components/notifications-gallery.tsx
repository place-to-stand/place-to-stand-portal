'use client'

import { useState } from 'react'

import type { NotificationTemplateEntry } from '@/lib/notifications/catalog'

import { ChatCardPreview } from './chat-card-preview'
import { NotificationSheet } from './notification-sheet'
import { NodeThumbnail, TemplateCard } from './template-card'
import {
  EMPTY_TEMPLATE_FILTERS,
  matchesTemplateFilters,
  NoMatchingTemplates,
  TemplateFilters,
  TemplateSection,
} from './template-gallery-parts'

/** Width a chat card is laid out at before it is scaled into the card. */
const CHAT_RENDER_WIDTH = 400

/**
 * Read-only catalog of every notification pushed outside the portal, one
 * section per destination, in the same gallery and sheet as the other tabs.
 */
export function NotificationsGallery({
  entries,
}: {
  entries: NotificationTemplateEntry[]
}) {
  const [filters, setFilters] = useState(EMPTY_TEMPLATE_FILTERS)
  const [openId, setOpenId] = useState<string | null>(null)
  // Kept after close so the sheet keeps its content while it slides out.
  const [shownId, setShownId] = useState<string | null>(null)

  if (entries.length === 0) {
    return (
      <section className='bg-background text-muted-foreground rounded-xl border p-6 text-sm shadow-sm'>
        No notifications are registered.
      </section>
    )
  }

  const visible = entries.filter(entry =>
    matchesTemplateFilters(filters, entry.audiences, [
      entry.name,
      entry.channel,
      entry.overview,
    ])
  )
  const channels = [...new Set(visible.map(entry => entry.channel))]

  return (
    <section className='bg-background flex flex-col gap-6 rounded-xl border p-4 shadow-sm'>
      <TemplateFilters value={filters} onChange={setFilters} />

      {visible.length === 0 ? (
        <NoMatchingTemplates />
      ) : (
        channels.map(channel => {
          const inChannel = visible.filter(entry => entry.channel === channel)
          return (
            <TemplateSection
              key={channel}
              id={channel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
              label={channel}
              count={inChannel.length}
            >
              {inChannel.map(entry => (
                <li key={entry.id}>
                  <TemplateCard
                    name={entry.name}
                    audiences={entry.audiences}
                    notice={entry.configured ? undefined : 'Webhook off'}
                    thumbnail={
                      <NodeThumbnail width={CHAT_RENDER_WIDTH}>
                        <div className='flex-1 bg-[#f1f3f4] p-5'>
                          <ChatCardPreview payload={entry.sample} />
                        </div>
                      </NodeThumbnail>
                    }
                    onOpen={() => {
                      setShownId(entry.id)
                      setOpenId(entry.id)
                    }}
                  />
                </li>
              ))}
            </TemplateSection>
          )
        })
      )}

      <NotificationSheet
        entry={entries.find(entry => entry.id === shownId) ?? null}
        open={openId !== null}
        onOpenChange={open => {
          if (!open) setOpenId(null)
        }}
      />
    </section>
  )
}
