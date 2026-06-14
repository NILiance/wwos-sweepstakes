import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PayoutForm } from "./payout-form";
import { TimezoneForm } from "./timezone-form";
import { PLATFORM_TZ } from "@/lib/tz";

export const metadata = { title: "Settings — WWOS Sweepstakes" };
export const revalidate = 0;

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/settings");

  const { data: accounts } = await supabase
    .from("payout_accounts")
    .select("id,method,identifier,is_preferred")
    .eq("user_id", user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();

  const paypal = accounts?.find((a) => a.method === "paypal");
  const venmo = accounts?.find((a) => a.method === "venmo");
  const preferred =
    accounts?.find((a) => a.is_preferred)?.method ?? "paypal";

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        ← My Entries
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Payout settings</h1>
      <p className="mt-1 text-sm text-muted">
        Where your winnings go. Prizes of $600 or more also require a W-9
        before payment.
      </p>
      <PayoutForm
        initial={{
          paypal: paypal?.identifier ?? "",
          venmo: venmo?.identifier ?? "",
          preferred,
        }}
      />

      <section className="mt-10 border-t border-border pt-8">
        <h2 className="text-xl font-bold">Timezone</h2>
        <p className="mt-1 text-sm text-muted">
          Game times and dates show in this zone. The platform runs on Eastern by
          default.
        </p>
        <TimezoneForm current={profile?.timezone ?? PLATFORM_TZ} />
      </section>
    </div>
  );
}
