"use client";

import { useActionState, useState } from "react";
import { saveSportPool } from "./actions";

export function SportPoolEditor({
  sweepstakesId,
  sportId,
  sportName,
  picks,
  autoCount,
  customNames,
}: {
  sweepstakesId: string;
  sportId: string;
  sportName: string;
  picks: number;
  autoCount: number;
  customNames: string[];
}) {
  const [state, formAction, pending] = useActionState(saveSportPool, null);
  const [open, setOpen] = useState(false);
  const isCustom = customNames.length > 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold">{sportName}</span>{" "}
          <span className="text-xs text-muted">· {picks} picks/entry</span>
          <div className="mt-1 text-sm">
            {isCustom ? (
              <span className="text-info">
                ✎ Custom pool — {customNames.length} entries
              </span>
            ) : (
              <span className="text-muted">
                Auto-derived — {autoCount} active teams
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-raised"
        >
          {open ? "Close" : isCustom ? "Edit list" : "Upload custom list"}
        </button>
      </div>

      {open && (
        <form action={formAction} className="mt-4">
          <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
          <input type="hidden" name="sport_id" value={sportId} />
          <textarea
            name="list"
            rows={6}
            defaultValue={customNames.join("\n")}
            placeholder={"One per line, e.g.\nDUKE\nKANSAS\nUCONN\n…"}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info"
          />
          <p className="mt-1 text-xs text-muted">
            Leave empty and save to reset to the auto pool. Unrecognized names
            are added as new entries for this sport.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button
              disabled={pending}
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save pool"}
            </button>
            {state && (
              <span className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
                {state.message}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
