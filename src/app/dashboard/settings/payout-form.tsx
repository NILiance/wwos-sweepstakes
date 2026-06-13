"use client";

import { useActionState } from "react";
import { savePayoutMethods } from "./actions";

const field =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info";

export function PayoutForm({
  initial,
}: {
  initial: { paypal: string; venmo: string; preferred: string };
}) {
  const [state, formAction, pending] = useActionState(savePayoutMethods, null);

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-lg border border-border bg-surface p-6">
      <label className="block text-sm font-medium">
        PayPal email
        <input name="paypal" type="email" defaultValue={initial.paypal} placeholder="you@example.com" className={field} />
      </label>
      <label className="block text-sm font-medium">
        Venmo handle
        <input name="venmo" defaultValue={initial.venmo} placeholder="@your-handle" className={field} />
      </label>
      <fieldset className="text-sm">
        <legend className="font-medium">Preferred method</legend>
        <div className="mt-2 flex gap-6">
          {["paypal", "venmo"].map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input
                type="radio"
                name="preferred"
                value={m}
                defaultChecked={initial.preferred === m}
                className="accent-[var(--red-500)]"
              />
              {m === "paypal" ? "PayPal" : "Venmo"}
            </label>
          ))}
        </div>
      </fieldset>
      {state && (
        <p className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </p>
      )}
      <button
        disabled={pending}
        className="rounded-md bg-accent px-6 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save payout methods"}
      </button>
    </form>
  );
}
