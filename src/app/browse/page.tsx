import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { usd } from "@/lib/format";
import { resolvePayouts, type PayoutEntry } from "@/lib/payouts";

export const metadata = { title: "Browse Pools — WWOS Sweepstakes" };
export const revalidate = 0;

type Card = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  season_label: string | null;
  status: string;
  pool_size: number;
  entry_price_cents: number;
  payout_structure: PayoutEntry[];
  sweepstakes_sports: {
    sport_id: string;
    picks_per_entry: number;
    sports: { name: string; short_name: string | null };
  }[];
  entries: { count: number }[];
};

export default async function BrowsePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sweepstakes")
    .select(
      "id,name,slug,description,season_label,status,pool_size,entry_price_cents,payout_structure,sweepstakes_sports(sport_id,picks_per_entry,sports(name,short_name)),entries(count)",
    )
    .eq("visibility", "public")
    .in("status", ["enrolling", "full", "drawing", "active"])
    .order("created_at", { ascending: false });

  const pools = (data ?? []) as unknown as Card[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-bold">Browse Pools</h1>
      <p className="mt-2 text-muted">
        Public sweepstakes open for entry. Private pools never appear here.
      </p>

      {pools.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-12 text-center text-muted">
          No open pools right now — check back soon.
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pools.map((p) => {
            const taken = p.entries?.[0]?.count ?? 0;
            const left = p.pool_size - taken;
            const top = resolvePayouts(
              p.payout_structure ?? [],
              p.pool_size * p.entry_price_cents,
            ).find((x) => x.place === 1);
            return (
              <Link
                key={p.id}
                href={`/s/${p.slug}`}
                className="group rounded-lg border border-border bg-surface p-6 transition hover:border-info"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold group-hover:text-info">
                    {p.name}
                  </h2>
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs uppercase tracking-wide text-muted">
                    {p.status}
                  </span>
                </div>
                {p.season_label && (
                  <p className="mt-0.5 text-xs text-muted">{p.season_label}</p>
                )}
                {top && (
                  <p className="mt-4 text-2xl font-extrabold text-brand-red">
                    {usd(top.amount_cents)}{" "}
                    <span className="text-sm font-medium text-muted">
                      to win
                    </span>
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.sweepstakes_sports?.map((s) => (
                    <span
                      key={s.sport_id}
                      className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-semibold text-info"
                    >
                      {s.sports?.short_name ?? s.sports?.name ?? s.sport_id}{" "}
                      ×{s.picks_per_entry}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                  <span className="font-semibold">
                    {usd(p.entry_price_cents)} entry
                  </span>
                  <span
                    className={
                      left <= 3 ? "font-semibold text-brand-red" : "text-muted"
                    }
                  >
                    {left > 0 ? `${left} of ${p.pool_size} spots left` : "Full"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
