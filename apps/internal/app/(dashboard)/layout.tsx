import type { ReactNode } from "react";
import { and, eq, isNull } from "drizzle-orm";

import { AppShell } from "@/components/layout/app-shell";
import { BackgroundSync } from "@/components/layout/background-sync";
import { isAdmin } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { oauthConnections } from "@/lib/db/schema";
import { getInboxSidebarCounts } from "@/lib/queries/threads";
import { getTranscriptCounts } from "@/lib/queries/transcripts";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  const userIsAdmin = isAdmin(user);
  const [emailCounts, transcriptCounts, [connection]] = await Promise.all([
    getInboxSidebarCounts(user.id),
    userIsAdmin
      ? getTranscriptCounts()
      : Promise.resolve({ unclassified: 0, classified: 0, dismissed: 0 }),
    db
      .select({ id: oauthConnections.id })
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.userId, user.id),
          eq(oauthConnections.provider, "GOOGLE"),
          isNull(oauthConnections.deletedAt)
        )
      )
      .limit(1),
  ]);

  const inboxTriageCount =
    emailCounts.unclassified + transcriptCounts.unclassified;

  return (
    <AppShell user={user} inboxTriageCount={inboxTriageCount}>
      <BackgroundSync isConnected={!!connection} />
      {children}
    </AppShell>
  );
}
