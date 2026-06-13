"use client";

import { resolveDispute } from "./actions";

export function DisputeRow({
  dispute,
}: {
  dispute: {
    id: string;
    reason: string;
    note: string | null;
    entry: string;
    pool: string;
    reporter: string;
  };
}) {
  return (
    <div className="rounded-md bg-surface-raised p-4 text-sm">
      <p>
        <span className="font-semibold uppercase text-brand-red">
          {dispute.reason.replace("_", " ")}
        </span>{" "}
        — <span className="font-semibold">{dispute.entry}</span> in{" "}
        {dispute.pool} · reported by {dispute.reporter}
      </p>
      {dispute.note && <p className="mt-1 text-muted">“{dispute.note}”</p>}
      <form action={resolveDispute} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="dispute_id" value={dispute.id} />
        <input
          name="resolution_note"
          placeholder="Resolution note (emailed to reporter)"
          className="min-w-64 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        <select
          name="status"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="fixed_central">Fixed — central score</option>
          <option value="adjusted_pool">Fixed — pool adjustment</option>
          <option value="rejected">Rejected — score stands</option>
        </select>
        <button className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover">
          Resolve
        </button>
      </form>
    </div>
  );
}
