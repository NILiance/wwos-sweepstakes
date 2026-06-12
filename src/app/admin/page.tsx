export const metadata = { title: "Admin — WWOS Sweepstakes" };

const MODULES = [
  ["Setup Wizard", "Create a sweepstakes from a template in minutes"],
  ["Enrollment", "Entries, payments, shipping queue, refunds"],
  ["Draw Control Room", "Configure, schedule, run and pace live drawings"],
  ["Data Ops", "Ingestion health, score alerts, manual entry, disputes"],
  ["Payout Center", "Payout runs, PayPal/Venmo batches, house-cut ledger"],
  ["Branding", "Themes, logos, media library"],
] as const;

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-bold">Admin</h1>
      <p className="mt-2 text-muted">Platform operations dashboard.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(([name, desc]) => (
          <div
            key={name}
            className="rounded-lg border border-border bg-surface p-6"
          >
            <h2 className="font-semibold">{name}</h2>
            <p className="mt-1 text-sm text-muted">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
