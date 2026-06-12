"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BuyButton({
  sweepstakesId,
  productId,
  disabled,
}: {
  sweepstakesId: string;
  productId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sweepstakesId, productId }),
    });
    if (res.status === 401) {
      router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    const data = await res.json();
    if (data.url) {
      location.href = data.url;
    } else {
      setError(data.error ?? "Could not start checkout.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={buy}
        disabled={disabled || busy}
        className="mt-5 w-full rounded-md bg-accent px-4 py-3 font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Starting checkout…" : "Buy Now"}
      </button>
      {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}
    </>
  );
}
