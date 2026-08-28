'use client';

import type { ReactNode } from "react";
import { Fragment, Suspense } from "react";
import { PostHogProvider as PHProvider } from "@posthog/react";
import posthog from "posthog-js";

import { RouterTransitionTracker } from "@/components/tracking/router-transition-tracker";
import { IdleResumeTracker } from "@/components/tracking/idle-resume-tracker";

type Props = {
  children: ReactNode;
};

export function PostHogProvider({ children }: Props) {
  return (
    <PHProvider client={posthog}>
      <Fragment>
        {children}
        {/* useSearchParams() consumer — Suspense keeps the root shell
            prerenderable (Cache Components); the tracker renders no UI. */}
        <Suspense fallback={null}>
          <RouterTransitionTracker />
        </Suspense>
        <IdleResumeTracker />
      </Fragment>
    </PHProvider>
  );
}

