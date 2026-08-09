'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'

import { useRecordCycle } from '@/hooks/use-record-cycle'

type CycleClient = {
  id: string
  slug: string | null
}

type ClientRecordCycleProps = {
  clients: CycleClient[]
  selectedClientId: string
}

/**
 * Hosts the `⌘[`/`⌘]` prev/next-client shortcuts on the client detail page
 * (PRD 004 §01, D14) — extracted from the retired ClientsLandingHeader.
 * Renders nothing.
 */
export function ClientRecordCycle({
  clients,
  selectedClientId,
}: ClientRecordCycleProps) {
  const router = useRouter()

  const selectedIndex = useMemo(
    () => clients.findIndex(client => client.id === selectedClientId),
    [clients, selectedClientId]
  )

  const navigateTo = useCallback(
    (client: CycleClient | undefined) => {
      if (!client) return
      router.push(`/clients/${client.slug ?? client.id}`)
    },
    [router]
  )

  useRecordCycle({
    canPrevious: selectedIndex > 0,
    canNext: selectedIndex >= 0 && selectedIndex < clients.length - 1,
    onPrevious: () => navigateTo(clients[selectedIndex - 1]),
    onNext: () => navigateTo(clients[selectedIndex + 1]),
  })

  return null
}
