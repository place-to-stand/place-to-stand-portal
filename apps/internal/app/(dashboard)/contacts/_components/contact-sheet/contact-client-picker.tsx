'use client'

import { Building2 } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'
import {
  SheetRecordList,
  SheetRecordRow,
} from '@/components/sheets/sheet-record-row'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

export type ContactClientOption = {
  id: string
  name: string
  slug: string
}

export type ContactClientListProps = {
  clients: ContactClientOption[]
}

/**
 * The clients this contact can see in the portal, one row each. Read-only:
 * set on each client's Portal access. Admins can open the client.
 */
export function ContactClientList({ clients }: ContactClientListProps) {
  const { open } = useSheetParams()
  const { isAdmin } = useViewerAccess()

  if (clients.length === 0) {
    return <EmptyState message='No client access yet.' />
  }

  return (
    <SheetRecordList>
      {clients.map(client => (
        <SheetRecordRow
          key={client.id}
          icon={Building2}
          title={client.name}
          onOpen={isAdmin ? () => open('client', client.id) : undefined}
        />
      ))}
    </SheetRecordList>
  )
}
