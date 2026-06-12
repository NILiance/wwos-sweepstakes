"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetSimulator, instantPreview } from "./actions";

export function ResetButton({
  label,
  mode = "reset",
}: {
  label: string;
  mode?: "reset" | "preview";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handle() {
    setBusy(true);
    setMessage(null);
    const r = mode === "preview" ? await instantPreview() : await resetSimulator();
    setMessage(r.message);
    setBusy(false);
    router.refresh();
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button
        onClick={handle}
        disabled={busy}
        className={
          mode === "preview"
            ? "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            : "rounded-md border border-info/50 px-4 py-2 text-sm font-semibold text-info hover:bg-info/10 disabled:opacity-50"
        }
      >
        {busy ? "Working…" : `${mode === "preview" ? "⚡" : "↺"} ${label}`}
      </button>
      {message && <span className="text-sm text-muted">{message}</span>}
    </span>
  );
}
