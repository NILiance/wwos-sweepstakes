"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { generateBracketField } from "./actions";

export function GenerateFieldButton({ sweepstakesId }: { sweepstakesId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (
      prev: { ok: boolean; message: string } | null,
      fd: FormData,
    ) => {
      const r = await generateBracketField(prev, fd);
      if (r.ok) router.refresh();
      return r;
    },
    null,
  );

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
      <button
        disabled={pending}
        className="rounded-md bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Generating…" : "Generate 64-team field"}
      </button>
      {state && (
        <span className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
