import type { Metadata } from 'next'

import { PeopleListPage } from '../_components/people-list-page'

export const metadata: Metadata = {
  title: 'People archive',
}

// permission: contacts.manage — PeopleListPage calls requirePage('contacts.manage')
export default async function ContactsArchivePage({
  searchParams,
}: PageProps<'/people/archive'>) {
  return <PeopleListPage params={await searchParams} mode='archive' />
}
