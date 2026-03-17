'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

import { Label } from '@/components/ui/label'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import type { ClientWithMetrics } from '@/lib/data/clients'

type ClientsLandingHeaderProps = {
  clients: ClientWithMetrics[]
  selectedClientId?: string | null
}

export function ClientsLandingHeader({
  clients,
  selectedClientId = null,
}: ClientsLandingHeaderProps) {
  const router = useRouter()

  const clientItems = useMemo(() => {
    return clients.map(client => ({
      value: client.id,
      label: client.name,
      keywords: [client.name, client.slug ?? ''].filter(Boolean),
    }))
  }, [clients])

  const selectedIndex = useMemo(() => {
    if (!selectedClientId) return -1
    return clients.findIndex(c => c.id === selectedClientId)
  }, [clients, selectedClientId])

  const canSelectPrevious = selectedIndex > 0
  const canSelectNext =
    selectedIndex >= 0 && selectedIndex < clients.length - 1

  const handleClientSelect = useCallback((clientId: string | null) => {
    if (!clientId) {
      router.push('/clients')
      return
    }

    const client = clients.find(c => c.id === clientId)
    if (client) {
      const path = client.slug ? `/clients/${client.slug}` : `/clients/${client.id}`
      router.push(path)
    }
  }, [clients, router])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return

      if (e.key === '[' && canSelectPrevious) {
        e.preventDefault()
        const prevClient = clients[selectedIndex - 1]
        if (prevClient) handleClientSelect(prevClient.id)
      } else if (e.key === ']' && canSelectNext) {
        e.preventDefault()
        const nextClient = clients[selectedIndex + 1]
        if (nextClient) handleClientSelect(nextClient.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canSelectNext, canSelectPrevious, clients, selectedIndex, handleClientSelect])

  return (
    <div className='min-w-[400px] flex-1 space-y-2'>
      <Label htmlFor='clients-client-select' className='sr-only'>
        Client Selector
      </Label>
      <SearchableCombobox
        id='clients-client-select'
        items={clientItems}
        value={selectedClientId ?? ''}
        onChange={value => handleClientSelect(value || null)}
        placeholder='Select a client...'
        searchPlaceholder='Search clients...'
        disabled={clientItems.length === 0}
        ariaLabel='Select a client'
        variant='heading'
      />
    </div>
  )
}
