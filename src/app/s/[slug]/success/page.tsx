import Link from "next/link";
import { notFound } from "next/navigation";
import { stripe } from "@/lib/stripe";
import { fulfillCheckoutSession } from "@/lib/fulfill";

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id } = await searchParams;
  if (!session_id) notFound();

  const session = await stripe.checkout.sessions.retrieve(session_id);
  const result = await fulfillCheckoutSession(session);

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      {result.ok ? (
        <>
          <p className="brand-script text-6xl text-brand-red">You&apos;re in!</p>
          <h1 className="mt-6 text-2xl font-bold">Entry confirmed</h1>
          <p className="mt-3 text-muted">
            Your spot is claimed. When the pool fills, you&apos;ll get an email
            with the live draw date — that&apos;s when you find out your teams.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-md bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
            >
              My Entries
            </Link>
            <Link
              href={`/s/${slug}`}
              className="rounded-md border border-border px-5 py-2.5 font-semibold hover:bg-surface-raised"
            >
              Back to pool
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Payment pending</h1>
          <p className="mt-3 text-muted">
            We haven&apos;t received payment confirmation yet
            {result.reason === "not_paid" ? "" : ` (${result.reason})`}. If you
            completed checkout, refresh this page in a moment — your entry will
            appear automatically.
          </p>
          <Link
            href={`/s/${slug}`}
            className="mt-8 inline-block rounded-md border border-border px-5 py-2.5 font-semibold hover:bg-surface-raised"
          >
            Back to pool
          </Link>
        </>
      )}
    </div>
  );
}
