import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PayoutForm } from "./payout-form";

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
    </div>
  );
}
