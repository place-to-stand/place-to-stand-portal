import type { Metadata } from 'next'

import { PeopleListPage } from './_components/people-list-page'

export const metadata: Metadata = {
  title: 'People',
}

// permission: contacts.manage — PeopleListPage calls requirePage('contacts.manage')
export default async function ContactsPage({
  searchParams,
}: PageProps<'/people'>) {
  return <PeopleListPage params={await searchParams} mode='active' />
}
