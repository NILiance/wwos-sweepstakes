import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { usd, ordinal } from "@/lib/format";

export const revalidate = 0;

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: sw } = await admin
    .from("sweepstakes")
    .select("id,name,slug,status,payout_structure,visibility")
    .eq("slug", slug)
    .single();
  if (!sw) notFound();

  const [{ data: entries }, { data: events }] = await Promise.all([
    admin
      .from("entries")
      .select("id,display_name")
      .eq("sweepstakes_id", sw.id)
      .eq("status", "active"),
    admin
      .from("point_events")
      .select("entry_id,points,team_id,teams(abbrev,sport_id)")
      .in(
        "entry_id",
        (
          await admin
            .from("entries")
            .select("id")
            .eq("sweepstakes_id", sw.id)
        ).data?.map((e) => e.id) ?? [],
      ),
  ]);

  const totals = new Map<string, number>();
  const bySport = new Map<string, Map<string, number>>();
  for (const ev of events ?? []) {
    totals.set(ev.entry_id, (totals.get(ev.entry_id) ?? 0) + ev.points);
    const sport = (ev.teams as unknown as { sport_id: string })?.sport_id ?? "?";
    if (!bySport.has(ev.entry_id)) bySport.set(ev.entry_id, new Map());
    const m = bySport.get(ev.entry_id)!;
    m.set(sport, (m.get(sport) ?? 0) + ev.points);
  }

  const ranked = (entries ?? [])
    .map((e) => ({
      id: e.id,
      name: e.display_name,
      total: totals.get(e.id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  const payouts = (sw.payout_structure ?? []) as {
    place: number;
    amount_cents: number;
  }[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href={`/s/${sw.slug}`} className="text-sm text-muted hover:text-foreground">
        ← {sw.name}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Standings</h1>
      <p className="mt-1 text-sm text-muted">
        Updated automatically as finals come in. Every point traces to a game —
        tap an entry on your dashboard for the full history.
      </p>

      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-surface">
        {ranked.map((e, i) => {
          const payout = payouts.find((p) => p.place === i + 1);
          const sports = bySport.get(e.id);
          return (
            <div
              key={e.id}
              className={`flex items-center gap-4 border-b border-border px-5 py-4 last:border-0 ${
                i === 0 ? "bg-surface-raised" : ""
              }`}
            >
              <span
                className={`w-10 text-lg font-extrabold ${
                  payout ? "text-brand-red" : "text-muted"
                }`}
              >
                {ordinal(i + 1)}
              </span>
              <div className="flex-1">
                <p className="font-bold">{e.name}</p>
                {sports && (
                  <p className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted">
                    {[...sports.entries()].map(([s, pts]) => (
                      <span key={s}>
                        <span className="uppercase">{s}</span> {pts}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              {payout && (
                <span className="text-sm font-semibold text-info">
                  {usd(payout.amount_cents)}
                </span>
              )}
              <span className="w-20 text-right text-2xl font-extrabold">
                {e.total}
              </span>
            </div>
          );
        })}
        {ranked.length === 0 && (
          <p className="p-8 text-center text-muted">No entries yet.</p>
        )}
      </div>
    </div>
  );
}
