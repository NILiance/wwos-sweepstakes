import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCommissionerPlan } from "@/lib/settings";
import { usd } from "@/lib/format";
import { JoinButton } from "./join-button";

export const metadata = { title: "Become a Commissioner — WWOS" };
export const revalidate = 0;

export default async function CommissionerJoinPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/commissioner/join");

  // Already a commissioner/admin? send to HQ
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role,is_admin")
    .eq("id", user.id)
    .single();
  if (profile?.role === "admin" || profile?.is_admin) redirect("/commissioner");
  const { data: sub } = await admin
    .from("commissioner_subscriptions")
    .select("status,paid_through")
    .eq("user_id", user.id)
    .maybeSingle();
  if (
    profile?.role === "commissioner" &&
    sub?.status === "active" &&
    (!sub.paid_through || new Date(sub.paid_through) > new Date())
  ) {
    redirect("/commissioner");
  }

  const plan = await getCommissionerPlan();
  const fee = plan.yearly_fee_cents ?? 0;

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">Run your own league</h1>
      <p className="mt-3 text-muted">
        Become a WWOS commissioner and use the platform to run your own pools —
        set up the field, draw live, customize scoring, and track standings all
        season. You handle your own entry money off-platform; the tech is on us.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-surface p-6">
        {!plan.enabled ? (
          <p className="text-muted">
            Commissioner sign-ups aren&apos;t open yet. Check back soon.
          </p>
        ) : (
          <>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-silver">
              Commissioner access
            </p>
            <p className="mt-2 text-4xl font-extrabold">
              {fee > 0 ? usd(fee) : "Free"}
              {fee > 0 && <span className="text-base font-medium text-muted"> / year</span>}
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted">
              <li>✓ Create unlimited leagues (draw or bracket)</li>
              <li>✓ Live draws, custom scoring, draw pools</li>
              <li>✓ Standings, scorecards, smack talk for your players</li>
              <li>✓ Track entry payments your own way</li>
            </ul>
            <JoinButton fee={fee} />
            <p className="mt-3 text-xs text-muted">
              Renews yearly. You&apos;ll get a reminder before it expires.
            </p>
          </>
        )}
      </div>

      <p className="mt-6 text-sm">
        <Link href="/" className="text-info hover:underline">
          ← Back home
        </Link>
      </p>
    </div>
  );
}
