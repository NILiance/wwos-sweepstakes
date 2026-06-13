import Link from "next/link";
import { poolAccess } from "@/lib/pool-access";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { entryTotals } from "@/lib/standings";

export const revalidate = 0;

export default async function PoolEntryPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  if (!(await poolAccess(slug)).allowed) return null;
  const admin = createAdminClient();

  const { data: entry } = await admin
    .from("entries")
    .select("id,display_name,status,sweepstakes!inner(id,name,slug)")
    .eq("id", id)
    .eq("sweepstakes.slug", slug)
    .single();
  if (!entry || entry.status !== "active") notFound();

  const [{ data: roster }, { data: events }] = await Promise.all([
    admin
      .from("rosters")
      .select(
        "team_id,sport_id,teams(name,abbrev),sports:sport_id(name,short_name,sort_order)",
      )
      .eq("entry_id", id),
    admin
      .from("point_events")
      .select(
        "points,rule_key,created_at,teams(abbrev,sport_id),games(starts_at,meta,home:teams!games_home_team_id_fkey(abbrev),away:teams!games_away_team_id_fkey(abbrev))",
      )
      .eq("entry_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const { total, bySport: sportSplit } = await entryTotals(id);
  const sportTotals = new Map(Object.entries(sportSplit));

  const teamIds = (roster ?? []).map((r) => r.team_id);
  const { data: upcoming } = teamIds.length
    ? await admin
        .from("games")
        .select(
          "starts_at,broadcast,sport_id,home:teams!games_home_team_id_fkey(id,abbrev),away:teams!games_away_team_id_fkey(id,abbrev)",
        )
        .eq("status", "scheduled")
        .gte("starts_at", new Date().toISOString())
        .lte("starts_at", new Date(Date.now() + 14 * 86400e3).toISOString())
        .or(
          `home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`,
        )
        .order("starts_at")
        .limit(12)
    : { data: [] };

  const bySport = new Map<string, NonNullable<typeof roster>>();
  for (const r of roster ?? []) {
    bySport.set(r.sport_id, [...(bySport.get(r.sport_id) ?? []), r]);
  }
  const sw = entry.sweepstakes as unknown as { slug: string; name: string };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href={`/s/${sw.slug}/standings`}
        className="text-sm text-muted hover:text-foreground"
      >
        ← Standings
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">{entry.display_name}</h1>
        <div className="text-right">
          <p className="text-4xl font-extrabold">{total}</p>
          <p className="text-xs uppercase tracking-wide text-muted">points</p>
        </div>
      </div>
      {sportTotals.size > 0 && (
        <p className="mt-2 flex flex-wrap gap-3 text-sm text-muted">
          {[...sportTotals.entries()].map(([s, pts]) => (
            <span key={s}>
              <span className="font-semibold uppercase text-info">{s}</span>{" "}
              {pts}
            </span>
          ))}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="font-bold">Roster</h2>
          <div className="mt-3 space-y-3">
            {[...bySport.entries()].map(([sportId, teams]) => (
              <div key={sportId} className="rounded-md bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {((teams[0].sports as unknown as { short_name?: string })
                    ?.short_name) ?? sportId}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {teams.map((t) => (
                    <span
                      key={t.team_id}
                      className="rounded-full bg-surface-raised px-2.5 py-1 text-sm font-semibold text-info"
                      title={(t.teams as unknown as { name: string }).name}
                    >
                      {(t.teams as unknown as { abbrev: string }).abbrev}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {(roster ?? []).length === 0 && (
              <p className="rounded-md border border-dashed border-border bg-surface p-6 text-sm text-muted">
                Roster assigned at the draw.
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-bold">Upcoming games 📺</h2>
          <div className="mt-3 divide-y divide-border rounded-md bg-surface px-4">
            {(upcoming ?? []).map((g, i) => {
              const bc = g.broadcast as { network?: string } | null;
              const home = g.home as unknown as { id: string; abbrev: string };
              const away = g.away as unknown as { id: string; abbrev: string };
              const mineHome = teamIds.includes(home?.id);
              return (
                <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <span>
                    <span className={!mineHome ? "font-bold text-info" : ""}>
                      {away?.abbrev}
                    </span>{" "}
                    @{" "}
                    <span className={mineHome ? "font-bold text-info" : ""}>
                      {home?.abbrev}
                    </span>
                    <span className="ml-2 text-xs uppercase text-muted">
                      {g.sport_id}
                    </span>
                  </span>
                  <span className="text-right text-xs text-muted">
                    {g.starts_at
                      ? new Date(g.starts_at).toLocaleString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "TBD"}
                    {bc?.network && (
                      <span className="ml-1 font-semibold text-foreground">
                        · {bc.network}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            {(upcoming ?? []).length === 0 && (
              <p className="py-4 text-sm text-muted">
                No scheduled games in the next two weeks.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="font-bold">Points history</h2>
        <div className="mt-3 divide-y divide-border rounded-md bg-surface px-4">
          {(events ?? []).map((e, i) => {
            const game = e.games as unknown as {
              starts_at: string | null;
              meta: { home_score?: number; away_score?: number } | null;
              home: { abbrev: string };
              away: { abbrev: string };
            } | null;
            return (
              <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="font-bold text-info">
                    {(e.teams as unknown as { abbrev: string })?.abbrev}
                  </span>
                  {game?.home && (
                    <span className="ml-2 text-muted">
                      {game.away?.abbrev} {game.meta?.away_score} @{" "}
                      {game.home?.abbrev} {game.meta?.home_score}
                    </span>
                  )}
                  <span className="ml-2 text-xs text-muted">
                    {e.rule_key === "regular"
                      ? "win"
                      : e.rule_key === "regular_half1"
                        ? "1st half"
                        : e.rule_key === "regular_half2"
                          ? "2nd half"
                          : e.rule_key.replace(/_/g, " ")}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-muted">
                    {game?.starts_at
                      ? new Date(game.starts_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </span>
                  <span className="font-bold text-info">+{e.points}</span>
                </span>
              </div>
            );
          })}
          {(events ?? []).length === 0 && (
            <p className="py-4 text-sm text-muted">No points yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
