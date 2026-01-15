"use client";

import type { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";

import { CONVEX_FLAGS } from "@/lib/feature-flags";

/**
 * Convex client instance
 *
 * Created only if Convex Auth is enabled via feature flag.
 * The URL is required when AUTH flag is enabled.
 */
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

let convex: ConvexReactClient | null = null;

if (CONVEX_FLAGS.AUTH) {
  if (!convexUrl) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is required when NEXT_PUBLIC_USE_CONVEX_AUTH is enabled"
    );
  }
  convex = new ConvexReactClient(convexUrl);
}

type Props = {
  children: ReactNode;
};

/**
 * Convex Client Provider (Client Component)
 *
 * Provides the Convex client to the application.
 * Must be wrapped by ConvexAuthNextjsServerProvider in layout.
 */
export function ConvexClientProvider({ children }: Props) {
  // If Convex Auth is not enabled, just render children
  if (!CONVEX_FLAGS.AUTH || !convex) {
    return <>{children}</>;
  }

  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}

/**
 * Get the Convex client instance
 *
 * Returns null if Convex Auth is not enabled.
 * Useful for components that need direct access to the client.
 */
export function getConvexClient(): ConvexReactClient | null {
  return convex;
}

// Re-export for backwards compatibility
export { ConvexClientProvider as ConvexProvider };
