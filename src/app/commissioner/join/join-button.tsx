"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

export function JoinButton({ fee }: { fee: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/commissioner/checkout", { method: "POST" });
    const data = await res.json();
    if (!data.clientSecret) throw new Error(data.error ?? "Checkout failed.");
    return data.clientSecret as string;
  }, []);

  async function start() {
    setError(null);
    if (fee > 0) {
      setOpen(true);
      return;
    }
    // free plan — activate directly
    setBusy(true);
    const res = await fetch("/api/commissioner/checkout", { method: "POST" });
    const data = await res.json();
    if (data.activated) {
      router.push("/commissioner");
      router.refresh();
    } else {
      setError(data.error ?? "Could not activate.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={start}
        disabled={busy}
        className="mt-5 w-full rounded-md bg-accent px-4 py-3 font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {busy ? "Activating…" : fee > 0 ? "Become a commissioner" : "Activate (free)"}
      </button>
      {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/80 p-4 backdrop-blur-sm sm:p-8">
          <div className="w-full max-w-lg">
            <div className="mb-2 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-raised"
              >
                ✕ Close
              </button>
            </div>
            <div className="overflow-hidden rounded-lg bg-white p-2 shadow-2xl">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ fetchClientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
