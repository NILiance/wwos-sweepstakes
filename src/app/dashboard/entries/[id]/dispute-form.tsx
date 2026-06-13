"use client";

import { useActionState, useState } from "react";
import { reportScoreIssue } from "./actions";

export function DisputeForm({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reportScoreIssue, null);

  if (!open && !state?.ok) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-xs text-muted underline hover:text-foreground"
      >
        🚩 Something wrong with your score? Report it
      </button>
    );
  }
  if (state?.ok) {
    return <p className="mt-3 text-sm text-info">{state.message}</p>;
  }

  return (
    <form
      action={formAction}
      className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-surface-raised p-4"
    >
      <input type="hidden" name="entry_id" value={entryId} />
      <select
        name="reason"
        required
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
      >
        <option value="wrong_winner">Wrong winner recorded</option>
        <option value="missing_game">Game missing</option>
        <option value="wrong_points">Wrong point value</option>
        <option value="duplicate">Duplicate points</option>
        <option value="other">Something else</option>
      </select>
      <input
        name="note"
        placeholder="Which game / what happened?"
        className="min-w-56 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
      />
      <button
        disabled={pending}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Sending…" : "Report"}
      </button>
      {state && !state.ok && (
        <span className="text-sm text-brand-red">{state.message}</span>
      )}
    </form>
  );
}
