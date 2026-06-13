"use client";

import { useActionState } from "react";
import { generatePayouts, advancePayout, toggleW9 } from "./actions";

export function GenerateButton({ sweepstakesId }: { sweepstakesId: string }) {
  const [state, formAction, pending] = useActionState(generatePayouts, null);
  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
      <button
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Working…" : "Generate payouts from standings"}
      </button>
      {state && (
        <span className={`text-xs ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}

export function AdvanceButton({
  payoutId,
  status,
  blocked,
}: {
  payoutId: string;
  status: string;
  blocked: boolean;
}) {
  if (status === "sent") return <span className="w-24" />;
  const label = status === "pending" ? "Approve" : "Mark sent";
  return (
    <form action={advancePayout}>
      <input type="hidden" name="payout_id" value={payoutId} />
      <button
        disabled={blocked && status === "approved"}
        title={blocked && status === "approved" ? "W-9 required before sending" : undefined}
        className="w-24 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
      >
        {label}
      </button>
    </form>
  );
}

export function W9Toggle({
  payoutId,
  status,
}: {
  payoutId: string;
  status: string;
}) {
  if (status === "not_required")
    return <span className="w-28 text-center text-xs text-muted">W-9 n/a</span>;
  const next = status === "requested" ? "received" : "requested";
  return (
    <form action={toggleW9}>
      <input type="hidden" name="payout_id" value={payoutId} />
      <input type="hidden" name="to" value={next} />
      <button
        className={`w-28 rounded-full border px-2 py-0.5 text-xs font-semibold ${
          status === "received"
            ? "border-info/50 text-info"
            : "border-brand-red/60 text-brand-red"
        }`}
        title="Toggle W-9 status"
      >
        W-9 {status}
      </button>
    </form>
  );
}
