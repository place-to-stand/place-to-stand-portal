import type { ReactNode } from "react";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

import { CONVEX_FLAGS } from "@/lib/feature-flags";

type Props = {
  children: ReactNode;
};

/**
 * Convex Auth Server Provider
 *
 * Server Component wrapper for Convex Auth.
 * This must wrap the entire application when Convex Auth is enabled.
 *
 * If Convex Auth is disabled, this simply passes through children.
 */
export async function ConvexAuthServerProvider({ children }: Props) {
  // If Convex Auth is not enabled, just render children
  if (!CONVEX_FLAGS.AUTH) {
    return <>{children}</>;
  }

  return (
    <ConvexAuthNextjsServerProvider>
      {children}
    </ConvexAuthNextjsServerProvider>
  );
}
