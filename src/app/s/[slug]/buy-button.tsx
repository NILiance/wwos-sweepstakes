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
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sweepstakesId, productId }),
    });
    if (res.status === 401) {
      router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
      throw new Error("Sign in to continue.");
    }
    const data = await res.json();
    if (!data.clientSecret) {
      setOpen(false);
      setError(data.error ?? "Could not start checkout.");
      throw new Error(data.error ?? "Could not start checkout.");
    }
    return data.clientSecret as string;
  }, [sweepstakesId, productId, router]);

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={disabled}
        className="mt-5 w-full rounded-md bg-accent px-4 py-3 font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Buy Now
      </button>
      {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/80 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg">
            <div className="mb-2 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-surface-raised"
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
