"use client";

import type { ComponentProps } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type Props = Omit<ComponentProps<typeof Button>, "onClick"> & {
  /** Show icon only (no text) */
  iconOnly?: boolean;
};

/**
 * Sign-Out Button
 *
 * Signs the user out of Convex Auth and redirects to sign-in page.
 */
export function SignOutButton({ iconOnly, children, ...props }: Props) {
  const { signOut } = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      // Redirect to sign-in after sign-out
      window.location.href = "/sign-in";
    } catch (error) {
      console.error("Sign-out failed:", error);
      setIsLoading(false);
    }
  };

  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSignOut}
        disabled={isLoading}
        aria-label="Sign out"
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      onClick={handleSignOut}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Signing out...
        </span>
      ) : (
        children || (
          <span className="inline-flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </span>
        )
      )}
    </Button>
  );
}
