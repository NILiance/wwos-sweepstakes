import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { poolStandings } from "@/lib/standings";
import { usd, ordinal } from "@/lib/format";

export const revalidate = 0;

const LINE_COLORS = [
  "#c0273d", "#a9d3ec", "#e8b339", "#6fcf97", "#bb8fce",
  "#f1948a", "#76d7ea", "#f5b041", "#aed581", "#a7a9ac",
  "#d98880", "#85c1e9", "#f8c471", "#82e0aa", "#d2b4de",
];

function TrendChart({
  series,
}: {
  series: { name: string; points: number[]; color: string }[];
}) {
  const weeks = series[0]?.points.length ?? 0;
  if (weeks < 2) return null;
  const W = 640;
  const H = 220;
  const PAD = 24;
  const max = Math.max(1, ...series.flatMap((s) => s.points));
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (weeks - 1);
  const y = (v: number) => H - PAD - (v * (H - PAD * 2)) / max;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Points by week">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={PAD} x2={W - PAD} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" opacity={0.08} />
          <text x={W - PAD + 2} y={y(max * f) + 3} fontSize={9} fill="currentColor" opacity={0.4}>
            {Math.round(max * f)}
          </text>
        </g>
      ))}
      {series.map((s) => (
        <polyline
          key={s.name}
          points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeLinejoin="round"
          opacity={0.9}
        />
      ))}
      {series.slice(0, 3).map((s) => (
        <text
          key={s.name}
          x={x(weeks - 1) - 4}
          y={y(s.points[weeks - 1]) - 5}
          fontSize={10}
          fontWeight={700}
          textAnchor="end"
          fill={s.color}
        >
          {s.name}
        </text>
      ))}
    </svg>
  );
}

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: sw } = await admin
    .from("sweepstakes")
    .select("id,name,slug,status,payout_structure")
    .eq("slug", slug)
    .single();
  if (!sw) notFound();

  const ranked = await poolStandings(sw.id);

  const [{ data: snaps }, { data: accolades }] = await Promise.all([
    admin
      .from("standings_snapshots")
      .select("entry_id,week,rank,total_points")
      .eq("sweepstakes_id", sw.id)
      .order("week"),
    admin
      .from("accolades")
      .select("entry_id,type,week,value")
      .eq("sweepstakes_id", sw.id)
      .order("week", { ascending: false })
      .limit(30),
  ]);

  // Movement: live rank vs most recent prior week's snapshot rank
  const weekList = [...new Set((snaps ?? []).map((s) => s.week))].sort();
  const prevWeek =
    weekList.length >= 2 ? weekList[weekList.length - 2] : undefined;
  const prevRank = new Map(
    (snaps ?? [])
      .filter((s) => s.week === prevWeek)
      .map((s) => [s.entry_id, s.rank]),
  );

  // Latest accolades per entry
  const latestWeek = accolades?.[0]?.week;
  const badges = new Map<string, string[]>();
  for (const a of accolades ?? []) {
    if (a.week !== latestWeek) continue;
    const icon = a.type === "weekly_high" ? "🏆" : "📈";
    badges.set(a.entry_id, [...(badges.get(a.entry_id) ?? []), icon]);
  }

  // Trend series in current-rank order so colors match the table
  const colorOf = new Map(ranked.map((e, i) => [e.id, LINE_COLORS[i % LINE_COLORS.length]]));
  const series = ranked.map((e) => ({
    name: e.name,
    color: colorOf.get(e.id)!,
    points: weekList.map(
      (w) =>
        (snaps ?? []).find((s) => s.entry_id === e.id && s.week === w)
          ?.total_points ?? 0,
    ),
  }));

  const payouts = (sw.payout_structure ?? []) as {
    place: number;
    amount_cents: number;
  }[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Standings</h1>
      <p className="mt-1 text-sm text-muted">
        Updated automatically as finals come in. Click any entry for roster,
        history and watch list.
      </p>

      {weekList.length >= 2 && (
        <div className="mt-6 rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Points by week
          </p>
          <TrendChart series={series} />
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
        {ranked.map((e, i) => {
          const payout = payouts.find((p) => p.place === i + 1);
          const prev = prevRank.get(e.id);
          const move = prev ? prev - (i + 1) : 0;
          return (
            <Link
              key={e.id}
              href={`/s/${sw.slug}/entries/${e.id}`}
              className={`flex items-center gap-3 border-b border-border px-5 py-4 transition last:border-0 hover:bg-surface-raised ${
                i === 0 ? "bg-surface-raised" : ""
              }`}
            >
              <span
                className={`w-9 text-lg font-extrabold ${payout ? "text-brand-red" : "text-muted"}`}
              >
                {ordinal(i + 1)}
              </span>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: colorOf.get(e.id) }}
              />
              <span className="w-10 text-sm font-semibold">
                {move > 0 && <span className="text-info">▲{move}</span>}
                {move < 0 && <span className="text-brand-red">▼{-move}</span>}
                {move === 0 && <span className="text-muted">—</span>}
              </span>
              <div className="flex-1">
                <p className="font-bold">
                  {e.name}
                  {(badges.get(e.id) ?? []).map((b) => (
                    <span key={b} className="ml-1.5" title={b === "🏆" ? "Weekly high score" : "Biggest climber"}>
                      {b}
                    </span>
                  ))}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted">
                  {Object.entries(e.bySport).map(([s, pts]) => (
                    <span key={s}>
                      <span className="uppercase">{s}</span> {pts}
                    </span>
                  ))}
                </p>
              </div>
              {payout && (
                <span className="text-sm font-semibold text-info">
                  {usd(payout.amount_cents)}
                </span>
              )}
              <span className="w-16 text-right text-2xl font-extrabold">
                {e.total}
              </span>
            </Link>
          );
        })}
        {ranked.length === 0 && (
          <p className="p-8 text-center text-muted">No entries yet.</p>
        )}
      </div>
    </div>
  );
}
