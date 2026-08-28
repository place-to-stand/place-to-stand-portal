import type { Metadata } from 'next'

import { redirect } from 'next/navigation'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = {
  title: 'Projects | Settings',
}

export default function ProjectsSettingsPage() {
  redirect('/projects')
}
