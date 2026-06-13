"use client";

import { useActionState } from "react";
import { addLeagueEntrant, recordPayment } from "@/app/commissioner/actions";
import { setStatus } from "@/app/admin/sweepstakes/actions";

const STATUSES = ["draft", "enrolling", "full", "drawing", "active", "completed", "archived"];
const field =
  "rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-info";

export function StatusControl({
  sweepstakesId,
  status,
}: {
  sweepstakesId: string;
  status: string;
}) {
  return (
    <form action={setStatus} className="flex items-center gap-2 text-sm">
      <input type="hidden" name="id" value={sweepstakesId} />
      <span className="text-muted">Status:</span>
      <select name="status" defaultValue={status} className={field}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-raised">
        Update
      </button>
    </form>
  );
}

export function EntrantForm({ sweepstakesId }: { sweepstakesId: string }) {
  const [state, formAction, pending] = useActionState(addLeagueEntrant, null);
  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
      <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
      <input
        name="display_name"
        required
        placeholder="Entrant name (e.g. Dustin/JB)"
        className={field}
      />
      <button
        disabled={pending}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add entrant"}
      </button>
      {state && (
        <span className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}

export function PaymentForm({
  sweepstakesId,
  entrants,
}: {
  sweepstakesId: string;
  entrants: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(recordPayment, null);
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
      <input name="payer_name" required placeholder="Who paid" className={field} />
      <input name="amount" type="number" min={0} step="0.01" placeholder="$" className={`${field} w-24`} />
      <input name="method" placeholder="Venmo / cash…" className={`${field} w-32`} />
      <select name="entry_id" className={field} defaultValue="">
        <option value="">— link entrant —</option>
        {entrants.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <select name="status" className={field} defaultValue="received">
        <option value="received">received</option>
        <option value="pending">pending</option>
        <option value="refunded">refunded</option>
      </select>
      <button
        disabled={pending}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Saving…" : "Log payment"}
      </button>
      {state && (
        <span className={`w-full text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
