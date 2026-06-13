"use client";

import { useActionState } from "react";
import { saveScoringMatrix } from "./actions";

export type SportRules = {
  sportId: string;
  name: string;
  rules: { rule_key: string; label: string; points: number; overridden: boolean }[];
  supportsHalf: boolean;
  half1: number;
  half2: number;
};

const numField =
  "w-20 rounded-md border border-border bg-background px-2 py-1 text-sm text-right outline-none focus:border-info";

export function ScoringMatrixForm({
  sweepstakesId,
  sports,
}: {
  sweepstakesId: string;
  sports: SportRules[];
}) {
  const [state, formAction, pending] = useActionState(saveScoringMatrix, null);

  return (
    <form action={formAction} className="mt-6 space-y-6">
      <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
      {sports.map((s) => (
        <section
          key={s.sportId}
          className="rounded-lg border border-border bg-surface p-5"
        >
          <h3 className="font-bold">{s.name}</h3>
          <div className="mt-3 divide-y divide-border">
            {s.rules.map((r) => (
              <div
                key={`${r.rule_key}`}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>
                  {r.label}
                  {r.overridden && (
                    <span className="ml-2 text-xs text-info">custom</span>
                  )}
                </span>
                <input
                  type="number"
                  name={`pts__${s.sportId}__${r.rule_key}__full_game`}
                  defaultValue={r.points}
                  className={numField}
                />
              </div>
            ))}
          </div>

          {s.supportsHalf && (
            <div className="mt-4 rounded-md bg-surface-raised p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Per-half scoring{" "}
                <span className="font-normal normal-case">
                  (optional — 0 to disable)
                </span>
              </p>
              <div className="mt-2 flex gap-6 text-sm">
                <label className="flex items-center gap-2">
                  1st half win
                  <input
                    type="number"
                    min={0}
                    name={`pts__${s.sportId}__regular__half1`}
                    defaultValue={s.half1 || ""}
                    placeholder="0"
                    className={numField}
                  />
                </label>
                <label className="flex items-center gap-2">
                  2nd half win
                  <input
                    type="number"
                    min={0}
                    name={`pts__${s.sportId}__regular__half2`}
                    defaultValue={s.half2 || ""}
                    placeholder="0"
                    className={numField}
                  />
                </label>
              </div>
            </div>
          )}
        </section>
      ))}

      {state && (
        <p className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </p>
      )}
      <button
        disabled={pending}
        className="rounded-md bg-accent px-6 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save scoring matrix"}
      </button>
    </form>
  );
}
