"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import Link from "next/link";

import {
  authErrorClass,
  authFieldLabelClass,
  authInputClass,
  authLinkClass,
  authPrimaryButtonClass,
  authSecondaryButtonClass,
} from "@pts/ui/auth-shell";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

import {
  signInWithPassword,
  sendMagicLink,
  type SignInState,
} from "./actions";
import { ClientPortalNotice } from "./client-portal-notice";

const INITIAL_STATE: SignInState = {};

/**
 * Hosted Supabase enforces an emails-per-hour limit. Without a visible cooldown a
 * user who clicks twice hits an opaque failure and assumes the feature is broken.
 */
const MAGIC_LINK_COOLDOWN_SECONDS = 30;

type Props = {
  redirectTo?: string;
};

export function SignInForm({ redirectTo }: Props) {
  const emailRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPendingPassword] = useActionState(
    signInWithPassword,
    INITIAL_STATE
  );

  const [magicLinkFeedback, setMagicLinkFeedback] = useState<{
    error?: string;
    success?: boolean;
  }>({});
  const [isMagicLinkPending, startMagicLinkTransition] = useTransition();
  const [cooldown, setCooldown] = useState(0);

  const isPending = isPendingPassword || isMagicLinkPending;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function handleMagicLink() {
    const email = emailRef.current?.value?.trim();
    if (!email) {
      setMagicLinkFeedback({ error: "Enter your email above first." });
      return;
    }

    startMagicLinkTransition(async () => {
      setMagicLinkFeedback({});
      const result = await sendMagicLink({ email, redirectTo });
      setMagicLinkFeedback(result);
      if (result.success) {
        setCooldown(MAGIC_LINK_COOLDOWN_SECONDS);
      }
    });
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
        <div className="space-y-2">
          <label className={authFieldLabelClass} htmlFor="email">
            Email
          </label>
          <input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={isPending}
            className={authInputClass}
          />
        </div>
        <div className="space-y-2">
          <label className={authFieldLabelClass} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={isPending}
            className={authInputClass}
          />
        </div>
        {state.error ? <p className={authErrorClass}>{state.error}</p> : null}
        {state.clientPortalUrl ? (
          <ClientPortalNotice clientPortalUrl={state.clientPortalUrl} />
        ) : null}
        <button
          type="submit"
          className={authPrimaryButtonClass}
          disabled={isPending}
        >
          {isPendingPassword ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>
        <div className="text-center text-sm">
          <Link
            href={
              redirectTo
                ? `/forgot-password?redirect=${encodeURIComponent(redirectTo)}`
                : "/forgot-password"
            }
            className={authLinkClass}
          >
            Forgot password?
          </Link>
        </div>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[#2a2b30]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[#16181c] px-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#a8a8ac]">
            or
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <GoogleSignInButton
          redirectTo={redirectTo}
          disabled={isPending}
          onError={(message) => setMagicLinkFeedback({ error: message })}
        />

        <button
          type="button"
          className={authSecondaryButtonClass}
          disabled={isPending || cooldown > 0}
          onClick={handleMagicLink}
        >
          {isMagicLinkPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Sending...
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Email me a sign-in link"}
            </span>
          )}
        </button>
      </div>

      {magicLinkFeedback.success ? (
        // Deliberately non-committal: the action returns success for unknown
        // addresses too, so this copy can't be used to probe for accounts.
        <p className="text-center text-sm text-[#a8a8ac]">
          If an account exists for that email, we&apos;ve sent a sign-in link.
          Check your inbox.
        </p>
      ) : null}
      {magicLinkFeedback.error ? (
        <p className={authErrorClass}>{magicLinkFeedback.error}</p>
      ) : null}
    </div>
  );
}
