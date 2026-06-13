"use client";

import { useActionState } from "react";
import { inviteCoOwner, removeCoOwner } from "./actions";

export function SharePanel({
  entryId,
  shares,
}: {
  entryId: string;
  shares: { id: string; email: string; status: string }[];
}) {
  const [state, formAction, pending] = useActionState(inviteCoOwner, null);

  return (
    <section className="mt-10 rounded-lg border border-border bg-surface p-6">
      <h2 className="font-bold">Split this entry 🤝</h2>
      <p className="mt-1 text-sm text-muted">
        Share with friends — they see this entry on their own dashboard.
        Payouts go to the entry owner.
      </p>

      {shares.length > 0 && (
        <div className="mt-3 space-y-2">
          {shares.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md bg-surface-raised px-4 py-2 text-sm"
            >
              <span>
                {s.email}{" "}
                <span className={`ml-1 text-xs ${s.status === "accepted" ? "text-info" : "text-muted"}`}>
                  {s.status}
                </span>
              </span>
              <form action={removeCoOwner}>
                <input type="hidden" name="share_id" value={s.id} />
                <button className="text-xs text-muted underline hover:text-brand-red">
                  remove
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <form action={formAction} className="mt-4 flex flex-wrap items-center gap-3">
        <input type="hidden" name="entry_id" value={entryId} />
        <input
          name="email"
          type="email"
          required
          placeholder="friend@example.com"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info"
        />
        <button
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Inviting…" : "Invite"}
        </button>
        {state && (
          <span className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
            {state.message}
          </span>
        )}
      </form>
    </section>
  );
}
