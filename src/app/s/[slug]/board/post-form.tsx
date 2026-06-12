"use client";

import { useActionState, useRef, useEffect } from "react";
import { postMessage } from "./actions";

export function PostForm({
  sweepstakesId,
  slug,
}: {
  sweepstakesId: string;
  slug: string;
}) {
  const [state, formAction, pending] = useActionState(postMessage, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="mt-6">
      <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
      <input type="hidden" name="slug" value={slug} />
      <textarea
        name="body"
        rows={2}
        maxLength={1000}
        required
        placeholder="Talk your talk…"
        className="w-full rounded-md border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-info"
      />
      <div className="mt-2 flex items-center justify-between">
        {state && !state.ok ? (
          <p className="text-sm text-brand-red">{state.message}</p>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
