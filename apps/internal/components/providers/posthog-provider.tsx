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
        {/* Reads useSearchParams(). Now that the root layout no longer touches
            cookies, static routes like /_not-found prerender through here, and
            Next requires a Suspense boundary around search-param readers on a
            prerendered page. */}
        <Suspense fallback={null}>
          <RouterTransitionTracker />
        </Suspense>
        <IdleResumeTracker />
      </Fragment>
    </PHProvider>
  );
}

