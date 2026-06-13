import Link from "next/link";
import { notFound } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { activateCommissioner } from "@/lib/commissioner";

export default async function CommissionerSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  if (!session_id) notFound();

  const session = await getStripe().checkout.sessions.retrieve(session_id);
  const ok =
    session.payment_status === "paid" &&
    session.metadata?.kind === "commissioner" &&
    session.metadata?.user_id;
  if (ok) {
    await activateCommissioner(session.metadata!.user_id as string, {
      amountCents: session.amount_total ?? 0,
      stripeSession: session.id,
    });
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      {ok ? (
        <>
          <p className="brand-script text-6xl text-brand-red">You&apos;re in!</p>
          <h1 className="mt-6 text-2xl font-bold">Commissioner access active</h1>
          <p className="mt-3 text-muted">
            Your league HQ is open. Spin up your first league whenever
            you&apos;re ready.
          </p>
          <Link
            href="/commissioner"
            className="mt-8 inline-block rounded-md bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
          >
            Open Commissioner HQ
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Payment pending</h1>
          <p className="mt-3 text-muted">
            We haven&apos;t confirmed payment yet. Refresh in a moment.
          </p>
        </>
      )}
    </div>
  );
}
