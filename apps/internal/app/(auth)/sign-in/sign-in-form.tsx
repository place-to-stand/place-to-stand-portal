"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

import {
  signInWithPassword,
  sendMagicLink,
  type SignInState,
} from "./actions";

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
          <Label htmlFor="email">Email</Label>
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={isPending}
          />
        </div>
        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPendingPassword ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
            </span>
          ) : (
            "Sign in"
          )}
        </Button>
        <div className="text-center text-sm">
          <Link
            href={
              redirectTo
                ? `/forgot-password?redirect=${encodeURIComponent(redirectTo)}`
                : "/forgot-password"
            }
            className="font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <div className="space-y-3">
        <GoogleSignInButton
          redirectTo={redirectTo}
          disabled={isPending}
          onError={(message) => setMagicLinkFeedback({ error: message })}
        />

        <Button
          type="button"
          variant="outline"
          className="w-full"
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
        </Button>
      </div>

      {magicLinkFeedback.success ? (
        // Deliberately non-committal: the action returns success for unknown
        // addresses too, so this copy can't be used to probe for accounts.
        <p className="text-center text-sm text-muted-foreground">
          If an account exists for that email, we&apos;ve sent a sign-in link.
          Check your inbox.
        </p>
      ) : null}
      {magicLinkFeedback.error ? (
        <p className="text-center text-sm text-destructive">
          {magicLinkFeedback.error}
        </p>
      ) : null}
    </div>
  );
}
