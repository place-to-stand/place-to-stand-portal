import { Suspense } from 'react'
import { redirect } from 'next/navigation'

// Redirect-only page: the redirect happens behind Suspense so the route keeps
// a prerenderable shell (Cache Components instant-navigation pattern).
async function ReportsRedirect() {
  return redirect('/reports/monthly-close')
}

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsRedirect />
    </Suspense>
  )
}
