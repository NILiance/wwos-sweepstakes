"use client";

import { useActionState } from "react";
import { syncNow } from "./actions";

const LEAGUES = ["all", "nfl", "cfb", "nba", "cbb", "nhl", "mlb", "wnba", "golf"];

export function SyncButton() {
  const [state, formAction, pending] = useActionState(syncNow, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <select
        name="league"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        {LEAGUES.map((l) => (
          <option key={l} value={l}>
            {l === "all" ? "All leagues" : l.toUpperCase()}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Syncing…" : "⟳ Sync now"}
      </button>
      {state && (
        <p className={`w-full text-xs ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
