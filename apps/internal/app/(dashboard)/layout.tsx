import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { fetchUnacknowledgedSubmissionCount } from "@/lib/data/form-submissions";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  // D6 (PRD 001): server-fetched unacknowledged count; refreshed via
  // revalidatePath('/', 'layout') from the submissions actions.
  const unacknowledgedSubmissionsCount =
    await fetchUnacknowledgedSubmissionCount(user);

  return (
    <AppShell
      user={user}
      unacknowledgedSubmissionsCount={unacknowledgedSubmissionsCount}
    >
      {children}
    </AppShell>
  );
}
