"use client";

import { useActionState } from "react";
import { saveSponsor } from "./actions";
import type { SponsorInfo } from "@/lib/settings";

const field =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info";

export function SponsorForm({ initial }: { initial: SponsorInfo }) {
  const [state, formAction, pending] = useActionState(saveSponsor, null);

  return (
    <form action={formAction} className="mt-4 space-y-4 rounded-lg border border-border bg-surface p-6">
      <label className="block text-sm font-medium">
        Sponsor / entity name
        <input name="name" defaultValue={initial.name} className={field} />
      </label>
      <label className="block text-sm font-medium">
        Address line 1
        <input name="address1" defaultValue={initial.address1} className={field} />
      </label>
      <label className="block text-sm font-medium">
        Address line 2 <span className="text-xs text-muted">(optional)</span>
        <input name="address2" defaultValue={initial.address2} className={field} />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium sm:col-span-1">
          City
          <input name="city" defaultValue={initial.city} className={field} />
        </label>
        <label className="block text-sm font-medium">
          State
          <input name="state" defaultValue={initial.state} className={field} />
        </label>
        <label className="block text-sm font-medium">
          ZIP
          <input name="zip" defaultValue={initial.zip} className={field} />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Extra mail-in instructions{" "}
        <span className="text-xs text-muted">(optional — shown after the address)</span>
        <textarea name="amoeNote" rows={2} defaultValue={initial.amoeNote} className={field} />
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
        {pending ? "Saving…" : "Save sponsor address"}
      </button>
    </form>
  );
}
