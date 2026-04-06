"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  signInWithPassword,
  sendMagicLink,
  type SignInState,
} from "./actions";

const INITIAL_STATE: SignInState = {};

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

  const isPending = isPendingPassword || isMagicLinkPending;

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

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={isPending}
        onClick={handleMagicLink}
      >
        {isMagicLinkPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Sending...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Mail className="h-4 w-4" /> Send magic link
          </span>
        )}
      </Button>
      {magicLinkFeedback.success ? (
        <p className="text-center text-sm text-muted-foreground">
          Check your email for a sign-in link.
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
