import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { entryTotals } from "@/lib/standings";
import { EntryScorecard } from "@/app/s/[slug]/entries/[id]/entry-scorecard";
import { fmt, fmtDate, PLATFORM_TZ } from "@/lib/tz";
import { SharePanel } from "./share-panel";
import { DisputeForm } from "./dispute-form";
import { EntryTabs, type EntryTab } from "./entry-tabs";

export const revalidate = 0;

export default async function EntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: entry } = await admin
    .from("entries")
    .select("id,display_name,owner_user_id,sweepstakes(id,name,slug,status)")
    .eq("id", id)
    .single();
  if (!entry) notFound();

  const { data: profile } = await admin
    .from("profiles")
    .select("role,is_admin,timezone")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin" || profile?.is_admin;
  const tz = profile?.timezone ?? PLATFORM_TZ;
  const isOwner = entry.owner_user_id === user.id;
  if (!isOwner && !isAdmin) {
    const { data: share } = await admin
      .from("entry_shares")
      .select("id")
      .eq("entry_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!share) redirect("/dashboard");
  }

  const sw = entry.sweepstakes as unknown as {
    id: string;
    name: string;
    slug: string;
    status: string;
  };

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
        "points,rule_key,created_at,teams(abbrev),games(starts_at,meta,home:teams!games_home_team_id_fkey(abbrev),away:teams!games_away_team_id_fkey(abbrev))",
      )
      .eq("entry_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const { total } = await entryTotals(id);

  // Per-team point totals for the personal scorecard (paginated)
  const teamPoints = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("point_events")
      .select("points,team_id")
      .eq("entry_id", id)
      .range(from, from + 999);
    if (!data?.length) break;
    for (const ev of data)
      teamPoints.set(ev.team_id, (teamPoints.get(ev.team_id) ?? 0) + ev.points);
    if (data.length < 1000) break;
  }

  const { data: shares } = await admin
    .from("entry_shares")
    .select("id,invited_email,status")
    .eq("entry_id", id);

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
        .limit(15)
    : { data: [] };

  const bySport = new Map<string, typeof roster>();
  for (const r of roster ?? []) {
    bySport.set(r.sport_id, [...(bySport.get(r.sport_id) ?? []), r]);
  }

  const scoreSections = [...bySport.entries()]
    .map(([sportId, teams]) => {
      const meta = teams![0].sports as unknown as {
        short_name?: string;
        name?: string;
        sort_order?: number;
      };
      const cards = teams!.map((t) => {
        const tm = t.teams as unknown as { abbrev: string; name: string };
        return {
          abbrev: tm.abbrev,
          name: tm.name,
          points: teamPoints.get(t.team_id) ?? 0,
        };
      });
      return {
        sportId,
        label: meta?.short_name || meta?.name || sportId,
        sortOrder: meta?.sort_order ?? 99,
        teams: cards,
        subtotal: cards.reduce((n, c) => n + c.points, 0),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const scorecardContent = (
    <EntryScorecard sections={scoreSections} total={total} />
  );

  const rosterContent = (
    <section>
      {(roster ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-surface p-6 text-sm text-muted">
          Assigned at the live draw — you&apos;ll see every pick land in real
          time.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...bySport.entries()].map(([sportId, teams]) => (
            <div key={sportId} className="rounded-md bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {((teams![0].sports as unknown as { short_name?: string; name: string })
                  ?.short_name) ?? sportId}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {teams!.map((t) => (
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
        </div>
      )}
    </section>
  );

  const gamesContent = (
    <section>
      {(upcoming ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-surface p-6 text-sm text-muted">
          No scheduled games for your teams in the next two weeks.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md bg-surface px-4">
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
                  {fmt(g.starts_at ?? null, tz)}
                  {bc?.network && (
                    <span className="ml-1 font-semibold text-foreground">
                      · {bc.network}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const historyContent = (
    <section>
      {(events ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-surface p-6 text-sm text-muted">
          Every point you earn appears here — the game, the team, the rule, the
          points. Full transparency.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md bg-surface px-4">
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
                  {game && (
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
                    {fmtDate(game?.starts_at ?? null, tz)}
                  </span>
                  <span className="font-bold text-info">+{e.points}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <DisputeForm entryId={entry.id} />
    </section>
  );

  const tabs: EntryTab[] = [
    { key: "scorecard", label: "🟩 Scorecard", content: scorecardContent },
    { key: "roster", label: "🏟 Roster", content: rosterContent },
    { key: "games", label: "📺 Upcoming Games", content: gamesContent },
    { key: "history", label: "📊 Points History", content: historyContent },
  ];
  if (isOwner) {
    tabs.push({
      key: "share",
      label: "🤝 Share Entry",
      content: (
        <SharePanel
          entryId={entry.id}
          shares={(shares ?? []).map((s) => ({
            id: s.id,
            email: s.invited_email ?? "—",
            status: s.status,
          }))}
        />
      ),
    });
    tabs.push({
      key: "payout",
      label: "💵 Get Paid",
      content: (
        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-bold">Where your winnings go</h2>
          <p className="mt-1 text-sm text-muted">
            Add your PayPal email or Venmo handle so prizes can be sent the
            moment the season settles. This is set once for your account and
            covers every pool you&apos;re in.
          </p>
          <Link
            href="/dashboard/settings"
            className="mt-4 inline-block rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Add / update payout method →
          </Link>
        </section>
      ),
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        ← My Entries
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{entry.display_name}</h1>
          <p className="mt-1 text-sm text-muted">
            <Link href={`/s/${sw.slug}`} className="text-info hover:underline">
              {sw.name}
            </Link>{" "}
            · {sw.status}
          </p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-extrabold">{total}</p>
          <p className="text-xs uppercase tracking-wide text-muted">points</p>
        </div>
      </div>

      <EntryTabs tabs={tabs} />
    </div>
  );
}
