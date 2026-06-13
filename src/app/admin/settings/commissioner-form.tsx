"use client";

import { useActionState } from "react";
import { saveCommissionerPlan } from "./actions";
import type { CommissionerPlan } from "@/lib/settings";

export function CommissionerPlanForm({ initial }: { initial: CommissionerPlan }) {
  const [state, formAction, pending] = useActionState(saveCommissionerPlan, null);

  return (
    <form action={formAction} className="mt-4 space-y-4 rounded-lg border border-border bg-surface p-6">
      <label className="block text-sm font-medium">
        Yearly fee ($)
        <input
          name="yearly_fee"
          type="number"
          min={0}
          step="0.01"
          defaultValue={(initial.yearly_fee_cents ?? 0) / 100 || ""}
          placeholder="e.g. 199"
          className="mt-1 w-40 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info"
        />
        <span className="ml-2 text-xs text-muted">
          Leave 0 for free. You can change this any time.
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={initial.enabled}
          className="accent-[var(--red-500)]"
        />
        Enable commissioner sign-ups
      </label>
      {state && (
        <p className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </p>
      )}
      <button
        disabled={pending}
        className="rounded-md bg-accent px-6 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save commissioner plan"}
      </button>
    </form>
  );
}
