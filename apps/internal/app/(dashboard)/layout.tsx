import { Suspense, type ReactNode } from 'react'
import { cookies } from 'next/headers'

import { AppShell } from '@/components/layout/app-shell'
import { AvatarPreloader } from '@/components/layout/avatar-preloader'
import { BusinessSetupBanner } from '@/components/layout/business-setup-banner'
import { roleCan } from '@/lib/auth/capabilities'
import { requirePage } from '@/lib/auth/session'
import { brandPropsFor, getBusinessIdentity } from '@/lib/business/identity'
import { fetchUnacknowledgedSubmissionCount } from '@/lib/data/form-submissions'
import { fetchNewFeedbackCount } from '@/lib/data/feedback'
import { getChangelog } from '@/lib/help/changelog'
import { listStaffWithPhotos } from '@/lib/queries/users'
import { presenceRoomKey } from '@/lib/sheets/presence/room-key'
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
  const businessPromise = getBusinessIdentity()
  // Server-fetched unacknowledged count; refreshed via
  // revalidatePath('/', 'layout') from the submissions actions. Submissions
  // are admin-only, so SALES users get no badge.
  const unacknowledgedSubmissionsCount = roleCan(
    user.role,
    'submissions.manage'
  )
    ? await fetchUnacknowledgedSubmissionCount(user)
    : 0
  // New feedback reports (not yet looked at, not spam), admin-only too.
  const newFeedbackCount = roleCan(user.role, 'feedback.manage')
    ? await fetchNewFeedbackCount(user)
    : 0
  // SSR-read collapse state so the sidebar renders in the right
  // mode on first paint (the ui/sidebar primitive writes this cookie on toggle).
  const cookieStore = await cookies()
  const staffWithPhotos = await staffWithPhotosPromise
  const business = await businessPromise
  // Until an admin saves Settings → Business, the seeded details stand in.
  const showSetupBanner =
    !business.confirmedAt && roleCan(user.role, 'settings.business')
  const sidebarDefaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <AppShell
      user={user}
      unacknowledgedSubmissionsCount={unacknowledgedSubmissionsCount}
      newFeedbackCount={newFeedbackCount}
      sidebarDefaultOpen={sidebarDefaultOpen}
      presenceKey={presenceRoomKey()}
      brand={brandPropsFor(business)}
      banner={showSetupBanner ? <BusinessSetupBanner /> : null}
      changelog={getChangelog()}
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
