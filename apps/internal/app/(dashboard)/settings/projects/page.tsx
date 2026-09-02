import type { Metadata } from 'next'
import { Suspense } from 'react'

import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Projects | Settings',
}

// Redirect-only page: the redirect happens behind Suspense so the route keeps
// a prerenderable shell (Cache Components instant-navigation pattern).
async function ProjectsSettingsRedirect() {
  return redirect('/projects')
}

export default function ProjectsSettingsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsSettingsRedirect />
    </Suspense>
  )
}
