"use client";

import { useActionState } from "react";
import { inviteUser } from "./actions";

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteUser, null);
  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
      <input
        name="email"
        type="email"
        required
        placeholder="email@example.com"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <input
        name="display_name"
        type="text"
        required
        placeholder="Display name"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send invite"}
      </button>
      {state && (
        <p className={`w-full text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
