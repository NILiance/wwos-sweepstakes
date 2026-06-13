import { createAdminClient } from "@/lib/supabase/admin";
import { usd } from "@/lib/format";

export const metadata = { title: "Admin — WWOS Sweepstakes" };
export const revalidate = 0;

export default async function AdminOverview() {
  const admin = createAdminClient();

  const [pools, entries, users, ledger] = await Promise.all([
    admin.from("sweepstakes").select("id,status", { count: "exact" }),
    admin
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("pot_ledger").select("amount_cents,type"),
  ]);

  const potCollected = (ledger.data ?? [])
    .filter((l) => l.type === "entry")
    .reduce((n, l) => n + l.amount_cents, 0);
  const enrolling = (pools.data ?? []).filter(
    (p) => p.status === "enrolling",
  ).length;

  const stats: [string, string][] = [
    ["Sweepstakes", String(pools.count ?? 0)],
    ["Enrolling now", String(enrolling)],
    ["Active entries", String(entries.count ?? 0)],
    ["Registered users", String(users.count ?? 0)],
    ["Pot collected", usd(potCollected)],
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-surface p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {label}
            </p>
            <p className="mt-1 text-2xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
