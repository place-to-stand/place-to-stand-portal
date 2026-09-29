'use client'

import Link from 'next/link'
import { Contact } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Separator } from '@pts/ui/separator'
import { LinkedRecordCard } from '@/components/sheets/linked-record-card'
import { SheetSection } from '@/components/sheets/sheet-section'
import type {
  UserAssignedClient,
  UserLinkedContact,
} from '@/lib/queries/users/assignments'
import { contactSheetHref } from '@/lib/sheets/hrefs'

type UserLinkedContactSectionProps = {
  /** The contact this portal user was promoted from; null when created here. */
  contact: UserLinkedContact | null
  /** Their live client memberships — what their portal actually shows. */
  clients: UserAssignedClient[]
}

/**
 * The user sheet's half of the contact ↔ portal user link; the contact
 * sheet's Portal access card is the other half.
 */
export function UserLinkedContactSection({
  contact,
  clients,
}: UserLinkedContactSectionProps) {
  return (
    <>
      <Separator />
      <SheetSection
        title='Linked contact'
        description={
          contact
            ? 'Portal access follows the clients linked to this contact.'
            : 'Create a portal account from their contact to link one.'
        }
      >
        {contact ? (
          <LinkedRecordCard
            icon={Contact}
            title={contact.name}
            description={contact.email}
            details={[
              {
                label: 'Clients',
                value: clients.length
                  ? clients.map(client => client.name).join(', ')
                  : 'None',
              },
            ]}
            action={
              // Navigates to the contacts list with this contact's sheet
              // open, rather than stacking it here.
              <Button variant='outline' size='sm' asChild>
                <Link href={contactSheetHref(contact.id)}>
                  <Contact />
                  Open contact
                </Link>
              </Button>
            }
          />
        ) : (
          <LinkedRecordCard icon={Contact} title='No linked contact' />
        )}
      </SheetSection>
    </>
  )
}
