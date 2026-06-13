"use client";

import { useActionState } from "react";
import { openNextSeasonAction } from "./actions";

const field =
  "rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-info";

export function NextSeasonForm({
  priorId,
  priorName,
}: {
  priorId: string;
  priorName: string;
}) {
  const [state, formAction, pending] = useActionState(openNextSeasonAction, null);

  if (state?.ok) return <p className="mt-3 text-sm text-info">{state.message}</p>;

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3 rounded-md bg-surface-raised p-4">
      <input type="hidden" name="prior_id" value={priorId} />
      <label className="text-xs text-muted">
        New season name
        <input name="name" required defaultValue={`${priorName} — Next Season`} className={`${field} mt-1 block w-56`} />
      </label>
      <label className="text-xs text-muted">
        Season label
        <input name="season_label" placeholder="2027–28" className={`${field} mt-1 block w-28`} />
      </label>
      <label className="text-xs text-muted">
        Renewal deadline
        <input name="deadline" type="date" required className={`${field} mt-1 block`} />
      </label>
      <button
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Creating…" : "🔁 Open next season"}
      </button>
      {state && !state.ok && (
        <span className="text-xs text-brand-red">{state.message}</span>
      )}
    </form>
  );
}
