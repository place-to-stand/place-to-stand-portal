import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { isAdmin } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { getInboxSidebarCounts } from "@/lib/queries/threads";
import { getTranscriptCounts } from "@/lib/queries/transcripts";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  const userIsAdmin = isAdmin(user);
  const [emailCounts, transcriptCounts] = await Promise.all([
    getInboxSidebarCounts(user.id),
    userIsAdmin
      ? getTranscriptCounts()
      : Promise.resolve({ unclassified: 0, classified: 0, dismissed: 0 }),
  ]);

  const inboxTriageCount =
    emailCounts.unclassified + transcriptCounts.unclassified;

  return (
    <AppShell user={user} inboxTriageCount={inboxTriageCount}>
      {children}
    </AppShell>
  );
}
