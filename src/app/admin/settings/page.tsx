import { requireStaff } from "@/lib/admin-guard";
import { getSponsor } from "@/lib/settings";
import { SponsorForm } from "./sponsor-form";

export const metadata = { title: "Settings — Admin" };
export const revalidate = 0;

export default async function SettingsPage() {
  await requireStaff("settings");
  const sponsor = await getSponsor();

  const paypalReady = !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET;

  const steps: { title: string; body: string }[] = [
    {
      title: "1 · Create a PayPal Business account",
      body: "At paypal.com, upgrade to (or open) a Business account for the sponsor entity. Personal accounts can't send Payouts.",
    },
    {
      title: "2 · Enable Payouts on the account",
      body: "In the PayPal Business dashboard, request access to the Payouts (mass payments) product. PayPal reviews and approves it — this can take a few days, so start early.",
    },
    {
      title: "3 · Create a REST API app",
      body: "Go to developer.paypal.com → Apps & Credentials. Create an app under the Live tab (use Sandbox first to test). Copy the Client ID and Secret.",
    },
    {
      title: "4 · Send the credentials to your developer",
      body: "Provide the Client ID, Secret, and whether you're starting in Sandbox or Live. They go into the app's environment as PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and PAYPAL_MODE — never committed to code.",
    },
    {
      title: "5 · Confirm Venmo + limits",
      body: "Venmo payouts ride the same Payouts API (US recipients). Confirm your per-transaction limit covers your top prize (e.g. $10,000) — request a limit increase from PayPal if needed.",
    },
    {
      title: "6 · Flip it on",
      body: "Once the credentials are in place, the Payout Center's 'Send' action switches from manual tracking to automatic PayPal/Venmo batch disbursement. Until then, payouts are tracked manually and paid outside the app.",
    },
  ];

  return (
    <div className="max-w-3xl space-y-10">
      {/* PayPal integration */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">PayPal / Venmo payouts</h2>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
              paypalReady
                ? "bg-info/10 text-info"
                : "bg-surface-raised text-muted"
            }`}
          >
            {paypalReady ? "Connected" : "Not connected yet"}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Automated payouts are optional and can be added any time. The Payout
          Center works manually today — these are the steps to enable automatic
          disbursement later.
        </p>
        <div className="mt-4 space-y-3">
          {steps.map((s) => (
            <div
              key={s.title}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <p className="font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Heads-up: prize disbursement falls under the same legal/processor
          review as the rest of the program — confirm with counsel before going
          live.
        </p>
      </section>

      {/* Sponsor address */}
      <section>
        <h2 className="text-lg font-bold">Sponsor mailing address</h2>
        <p className="mt-1 text-sm text-muted">
          Used on every sweepstakes&apos; official rules for the free mail-in
          (no purchase necessary) entry method. Required before launch.
        </p>
        <SponsorForm initial={sponsor} />
      </section>
    </div>
  );
}
