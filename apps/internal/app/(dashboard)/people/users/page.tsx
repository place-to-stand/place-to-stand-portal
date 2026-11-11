import type { Metadata } from 'next'

import { PeopleListPage } from '../_components/people-list-page'

export const metadata: Metadata = {
  title: 'Users',
}

// permission: settings.users — PeopleListPage calls requirePage('settings.users') for this mode
export default async function UsersPage({
  searchParams,
}: PageProps<'/people/users'>) {
  return <PeopleListPage params={await searchParams} mode='users' />
}
