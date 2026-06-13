"use client";

import { useState } from "react";
import { demoLoginUrl } from "./actions";

export function DemoLoginButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const r = await demoLoginUrl();
    if (r.ok && r.url) {
      window.location.href = r.url;
    } else {
      setError(r.message);
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button
        onClick={go}
        disabled={busy}
        className="rounded-md border border-info/50 px-4 py-2 text-sm font-semibold text-info hover:bg-info/10 disabled:opacity-50"
      >
        {busy ? "Switching…" : "👤 Demo as entrant"}
      </button>
      {error && <span className="text-xs text-brand-red">{error}</span>}
    </span>
  );
}
