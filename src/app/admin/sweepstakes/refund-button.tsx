"use client";

import { useActionState } from "react";
import { refundEntry } from "./actions";

export function RefundButton({ entryId, name }: { entryId: string; name: string }) {
  const [state, formAction, pending] = useActionState(refundEntry, null);

  if (state?.ok) return <span className="text-xs text-info">{state.message}</span>;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Refund and withdraw "${name}"? This reopens their spot.`)) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="entry_id" value={entryId} />
      <button
        disabled={pending}
        className="ml-1 text-xs text-muted underline hover:text-brand-red disabled:opacity-50"
        title="Refund & withdraw entry"
      >
        {pending ? "…" : "refund"}
      </button>
      {state && !state.ok && (
        <span className="ml-1 text-xs text-brand-red">{state.message}</span>
      )}
    </form>
  );
}
