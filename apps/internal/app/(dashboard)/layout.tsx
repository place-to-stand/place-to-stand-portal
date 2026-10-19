import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { requireCrmUser } from "@/lib/auth/session";
import { fetchUnacknowledgedSubmissionCount } from "@/lib/data/form-submissions";
import { SheetHost } from "@/lib/sheets/sheet-host";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // The shell admits CRM staff (ADMIN, USER). Each page guards itself:
  // admin-only pages call requireUser(), which sends USER to their home page.
  const user = await requireCrmUser();
  // D6 (PRD 001): server-fetched unacknowledged count; refreshed via
  // revalidatePath('/', 'layout') from the submissions actions. Submissions
  // are admin-only, so USER gets no badge.
  const unacknowledgedSubmissionsCount =
    user.role === "ADMIN"
      ? await fetchUnacknowledgedSubmissionCount(user)
      : 0;
  // PRD 004 §02: SSR-read collapse state so the sidebar renders in the right
  // mode on first paint (the ui/sidebar primitive writes this cookie on toggle).
  const cookieStore = await cookies();
  const sidebarDefaultOpen =
    cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AppShell
      user={user}
      unacknowledgedSubmissionsCount={unacknowledgedSubmissionsCount}
      sidebarDefaultOpen={sidebarDefaultOpen}
    >
      {children}
      {/* Global sheet host: renders entity sheets for `?client=`/`?task=`/…
          params on routes that don't handle them with their own instances. */}
      <Suspense fallback={null}>
        <SheetHost />
      </Suspense>
    </AppShell>
  );
}
