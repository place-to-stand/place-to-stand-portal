import { Suspense, type ReactNode } from 'react'
import { cookies } from 'next/headers'

import { AppShell } from '@/components/layout/app-shell'
import { AvatarPreloader } from '@/components/layout/avatar-preloader'
import { roleCan } from '@/lib/auth/capabilities'
import { requirePage } from '@/lib/auth/session'
import { fetchUnacknowledgedSubmissionCount } from '@/lib/data/form-submissions'
import { listStaffWithPhotos } from '@/lib/queries/users'
import { SheetHost } from '@/lib/sheets/sheet-host'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  // The shell admits CRM staff (ADMIN, SALES). Each page guards itself:
  // each calls requirePage(<capability>), which sends SALES users without it to their home page.
  const user = await requirePage('portal.sign_in')
  // Started now so it runs alongside the reads below.
  const staffWithPhotosPromise = listStaffWithPhotos()
  // D6 (PRD 001): server-fetched unacknowledged count; refreshed via
  // revalidatePath('/', 'layout') from the submissions actions. Submissions
  // are admin-only, so SALES users get no badge.
  const unacknowledgedSubmissionsCount = roleCan(
    user.role,
    'submissions.manage'
  )
    ? await fetchUnacknowledgedSubmissionCount(user)
    : 0
  // PRD 004 §02: SSR-read collapse state so the sidebar renders in the right
  // mode on first paint (the ui/sidebar primitive writes this cookie on toggle).
  const cookieStore = await cookies()
  const staffWithPhotos = await staffWithPhotosPromise
  const sidebarDefaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <AppShell
      user={user}
      unacknowledgedSubmissionsCount={unacknowledgedSubmissionsCount}
      sidebarDefaultOpen={sidebarDefaultOpen}
    >
      {children}
      <AvatarPreloader staff={staffWithPhotos} />
      {/* Global sheet host: renders entity sheets for `?company=`/`?task=`/…
          params on routes that don't handle them with their own instances. */}
      <Suspense fallback={null}>
        <SheetHost />
      </Suspense>
    </AppShell>
  )
}
