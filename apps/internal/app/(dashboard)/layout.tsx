import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { fetchUnacknowledgedSubmissionCount } from "@/lib/data/form-submissions";
import { SheetHost } from "@/lib/sheets/sheet-host";

// Reads session + cookies behind Suspense so the dashboard segment keeps a
// prerenderable shell (Cache Components): the fallback paints the chrome
// footprint instantly while auth and data resolve.
async function DashboardShell({ children }: { children: ReactNode }) {
  const user = await requireUser();
  // D6 (PRD 001): server-fetched unacknowledged count; refreshed via
  // revalidatePath('/', 'layout') from the submissions actions.
  const unacknowledgedSubmissionsCount =
    await fetchUnacknowledgedSubmissionCount(user);
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

// Structural placeholder matching AppShell's footprint (sidebar rail +
// content column) so the static shell paints layout, not a blank page.
function DashboardShellFallback() {
  return (
    <div className="bg-muted flex h-screen min-h-0 overflow-hidden">
      <div className="hidden w-[13rem] shrink-0 md:block" />
      <div className="flex h-screen min-h-0 min-w-0 flex-1 flex-col" />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardShellFallback />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
