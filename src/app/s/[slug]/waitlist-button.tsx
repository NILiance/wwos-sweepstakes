"use client";

import { useActionState } from "react";
import { joinWaitlist } from "./waitlist-actions";

export function WaitlistButton({ sweepstakesId }: { sweepstakesId: string }) {
  const [state, formAction, pending] = useActionState(joinWaitlist, null);

  if (state?.ok) return <p className="mt-3 text-sm text-info">{state.message}</p>;

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
      <button
        disabled={pending}
        className="w-full rounded-md border border-info/50 px-4 py-2.5 text-sm font-semibold text-info hover:bg-info/10 disabled:opacity-50"
      >
        {pending ? "Joining…" : "🔔 Join the waitlist"}
      </button>
      {state && !state.ok && (
        <p className="mt-2 text-xs text-brand-red">{state.message}</p>
      )}
    </form>
  );
}
