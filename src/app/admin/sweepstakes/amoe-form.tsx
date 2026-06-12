"use client";

import { useActionState } from "react";
import { addAmoeEntry } from "./actions";

export function AmoeForm({ sweepstakesId }: { sweepstakesId: string }) {
  const [state, formAction, pending] = useActionState(addAmoeEntry, null);

  return (
    <form
      action={formAction}
      className="mt-3 flex flex-wrap items-end gap-3 rounded-md bg-surface-raised p-4"
    >
      <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
      <div>
        <label htmlFor={`amoe-email-${sweepstakesId}`} className="block text-xs font-medium text-muted">
          Entrant email
        </label>
        <input
          id={`amoe-email-${sweepstakesId}`}
          name="email"
          type="email"
          required
          className="mt-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor={`amoe-name-${sweepstakesId}`} className="block text-xs font-medium text-muted">
          Display name
        </label>
        <input
          id={`amoe-name-${sweepstakesId}`}
          name="display_name"
          type="text"
          required
          className="mt-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add entry"}
      </button>
      {state && (
        <p className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
