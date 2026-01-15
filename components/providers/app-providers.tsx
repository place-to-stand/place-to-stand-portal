'use client';

import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/toaster";

import { ConvexProvider } from "./convex-provider";
import { ReactQueryProvider } from "./react-query-provider";
import { PostHogProvider } from "./posthog-provider";
import { ThemeProvider } from "./theme-provider";

type Props = {
  children: ReactNode;
};

export function AppProviders({ children }: Props) {
  return (
    <ConvexProvider>
      <PostHogProvider>
        <ThemeProvider>
          <ReactQueryProvider>
            {children}
            <Toaster />
          </ReactQueryProvider>
        </ThemeProvider>
      </PostHogProvider>
    </ConvexProvider>
  );
}
