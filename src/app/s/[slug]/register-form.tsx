"use client";

import { useActionState } from "react";
import { registerForLeague } from "./register-actions";

const field =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info";

export function RegisterForm({
  slug,
  disabled,
}: {
  slug: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(registerForLeague, null);

  if (state?.ok) {
    return (
      <div className="mt-3 rounded-md border border-info/40 bg-info/10 p-4 text-sm">
        ✅ {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <label className="block text-sm font-medium">
        Your name *
        <input name="display_name" required className={field} />
      </label>
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" className={field} />
      </label>
      <label className="block text-sm font-medium">
        Phone
        <input name="phone" className={field} />
      </label>
      <button
        type="submit"
        disabled={pending || disabled}
        className="w-full rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {disabled ? "Registration closed" : pending ? "Registering…" : "Register for this league"}
      </button>
      {state && !state.ok && (
        <p className="text-sm text-brand-red">{state.message}</p>
      )}
      <p className="text-xs leading-5 text-muted">
        This league is run by a commissioner — buy-in is handled directly with
        them, not on this platform.
      </p>
    </form>
  );
}
