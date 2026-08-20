"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import {
  authErrorClass,
  authFieldLabelClass,
  authInputClass,
  authPrimaryButtonClass,
} from "@pts/ui/auth-shell";
import { DisabledFieldTooltip } from "@/components/ui/disabled-field-tooltip";

import {
  requestPasswordReset,
  type ForgotPasswordState,
} from "./actions";
import { PENDING_REASON } from "@/lib/forms/form-controls";

const INITIAL_STATE: ForgotPasswordState = {};
const pendingReason = PENDING_REASON;

type Props = {
  redirectTo?: string;
};

export function ForgotPasswordForm({ redirectTo }: Props) {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    INITIAL_STATE
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="redirect" value={redirectTo ?? ""} />
      <div className="space-y-2">
        <label className={authFieldLabelClass} htmlFor="email">
          Email
        </label>
        <DisabledFieldTooltip disabled={isPending} reason={isPending ? pendingReason : null}>
          <input
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
        </DisabledFieldTooltip>
      </div>
      {state.error ? <p className={authErrorClass}>{state.error}</p> : null}
      {state.success ? (
        <p className="border border-[#b5f542]/40 bg-[#b5f542]/10 px-3 py-2 text-sm text-[#b5f542]">
          If that email is associated with an account, we just sent instructions to reset the password.
        </p>
      ) : null}
      <DisabledFieldTooltip disabled={isPending} reason={isPending ? pendingReason : null}>
        <button
          type="submit"
          className={authPrimaryButtonClass}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sending...
            </>
          ) : (
            "Send reset link"
          )}
        </button>
      </DisabledFieldTooltip>
    </form>
  );
}
