'use client'

import { EmptyState } from '@pts/ui/empty-state'
import { ClientRecordRow } from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'

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
  const { isAdmin } = useViewerAccess()

  if (clients.length === 0) {
    return <EmptyState message='No client access yet.' />
  }

  return (
    <SheetRecordList>
      {clients.map(client => (
        <ClientRecordRow key={client.id} client={client} openable={isAdmin} />
      ))}
    </SheetRecordList>
  )
}
