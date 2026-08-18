"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { authSecondaryButtonClass } from "@pts/ui/auth-shell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  /** Relative path to land on after the callback exchanges the code. */
  redirectTo?: string;
  disabled?: boolean;
  onError?: (message: string) => void;
};

/**
 * OAuth needs a full browser redirect, so this stays client-side rather than
 * going through the server action the password form uses.
 *
 * Styled with the auth shell's control classes rather than the app Button:
 * the sign-in screen is the only place this renders, and it sits on the
 * marketing site's dark blueprint panel rather than the themed dashboard.
 */
export function GoogleSignInButton({ redirectTo, disabled, onError }: Props) {
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const callbackPath = redirectTo
        ? `/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`
        : "/auth/callback";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${callbackPath}` },
      });

      if (error) {
        console.error("Failed to start Google sign-in", error);
        onError?.("We couldn't reach Google. Please try again.");
        setIsPending(false);
      }
      // On success the browser navigates away — leave the spinner running.
    } catch {
      onError?.("We couldn't reach Google. Please try again.");
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      className={authSecondaryButtonClass}
      disabled={disabled || isPending}
      onClick={handleClick}
    >
      {isPending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Redirecting...
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <GoogleMark /> Continue with Google
        </span>
      )}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
