import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { SyncButton } from "./sync-button";
import { DisputeRow } from "./dispute-row";
import { GameFixRow, AddGameForm, type ConsoleGame } from "./game-console";

export const metadata = { title: "Data Ops — Admin" };
export const revalidate = 0;

export default async function DataOpsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; qsport?: string }>;
}) {
  await requireStaff("dataops");
  const admin = createAdminClient();
  const { q, qsport } = await searchParams;

  const { data: disputes } = await admin
    .from("disputes")
    .select(
      "id,reason,note,status,created_at,entries(display_name,sweepstakes(name)),profiles:user_id(display_name)",
    )
    .in("status", ["open", "under_review"])
    .order("created_at");

  const [{ data: sports }, { data: alerts }, { data: recent }] =
    await Promise.all([
      admin.from("sports").select("id,name").order("sort_order"),
      admin
        .from("data_alerts")
        .select("id,type,detail,status,created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("games")
        .select(
          "sport_id,status,starts_at,meta,broadcast,home:teams!games_home_team_id_fkey(abbrev),away:teams!games_away_team_id_fkey(abbrev),winner:teams!games_winner_team_id_fkey(abbrev)",
        )
        .eq("status", "final")
        .order("starts_at", { ascending: false })
        .limit(12),
    ]);

  // Manual console: rule keys per sport + game search
  const { data: ruleRows } = await admin
    .from("scoring_rules")
    .select("sport_id,rule_key")
    .is("sweepstakes_id", null);
  const ruleKeysBySport: Record<string, string[]> = {};
  for (const r of ruleRows ?? []) {
    ruleKeysBySport[r.sport_id] = [
      ...new Set([...(ruleKeysBySport[r.sport_id] ?? []), r.rule_key]),
    ];
  }

  let consoleGames: ConsoleGame[] = [];
  if (q) {
    const sport = qsport ?? "mlb";
    const { data: matchTeams } = await admin
      .from("teams")
      .select("id")
      .eq("sport_id", sport)
      .or(`abbrev.ilike.%${q}%,name.ilike.%${q}%`);
    const ids = (matchTeams ?? []).map((t) => t.id);
    if (ids.length) {
      const { data: found } = await admin
        .from("games")
        .select(
          "id,sport_id,status,event_type,starts_at,meta,winner_team_id,home:teams!games_home_team_id_fkey(id,abbrev),away:teams!games_away_team_id_fkey(id,abbrev)",
        )
        .eq("sport_id", sport)
        .or(
          `home_team_id.in.(${ids.join(",")}),away_team_id.in.(${ids.join(",")}),winner_team_id.in.(${ids.join(",")})`,
        )
        .order("starts_at", { ascending: false })
        .limit(10);
      consoleGames = (found ?? []).map((g) => {
        const home = g.home as unknown as { id: string; abbrev: string } | null;
        const away = g.away as unknown as { id: string; abbrev: string } | null;
        const meta = g.meta as { home_score?: number; away_score?: number } | null;
        return {
          id: g.id,
          sport: g.sport_id,
          label: `${away?.abbrev ?? "—"} @ ${home?.abbrev ?? "—"} · ${
            g.starts_at
              ? new Date(g.starts_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "TBD"
          }`,
          status: g.status,
          eventType: g.event_type,
          homeId: home?.id ?? null,
          homeAbbrev: home?.abbrev ?? null,
          awayId: away?.id ?? null,
          awayAbbrev: away?.abbrev ?? null,
          winnerId: g.winner_team_id,
          homeScore: meta?.home_score ?? null,
          awayScore: meta?.away_score ?? null,
        };
      });
    }
  }

  const counts = await Promise.all(
    (sports ?? []).map(async (s) => {
      const { count } = await admin
        .from("games")
        .select("id", { count: "exact", head: true })
        .eq("sport_id", s.id);
      return [s.id, count ?? 0] as const;
    }),
  );

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Ingestion</h2>
            <p className="mt-1 text-sm text-muted">
              Central repository — one sync feeds every sweepstakes. Daily auto
              sync at 9:00 UTC; run manually any time.
            </p>
          </div>
          <SyncButton />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {counts.map(([id, count]) => (
            <span
              key={id}
              className="rounded-full bg-surface-raised px-3 py-1 text-xs"
            >
              <span className="font-bold uppercase text-info">{id}</span>{" "}
              <span className="text-muted">{count} games</span>
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="font-bold">Manual score console 🛠</h2>
        <p className="mt-1 text-sm text-muted">
          Fix a result, refine a playoff round, or record a game the feed
          missed (LIV, postponed finishes). Corrections hit the central
          repository — every pool rescores instantly.
        </p>

        <form className="mt-4 flex flex-wrap items-center gap-2" method="get">
          <select
            name="qsport"
            defaultValue={qsport ?? "mlb"}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            {(sports ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.id.toUpperCase()}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="team / golfer abbrev"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
          <button className="rounded-md border border-border px-4 py-1.5 text-sm font-semibold hover:bg-surface-raised">
            Find games
          </button>
        </form>

        {consoleGames.length > 0 && (
          <div className="mt-3 space-y-2">
            {consoleGames.map((g) => (
              <GameFixRow
                key={g.id}
                game={g}
                ruleKeys={ruleKeysBySport[g.sport] ?? ["regular"]}
              />
            ))}
          </div>
        )}
        {q && consoleGames.length === 0 && (
          <p className="mt-3 text-sm text-muted">No games matched.</p>
        )}

        <p className="mt-5 text-sm font-semibold">Record a missing result</p>
        <AddGameForm
          sports={(sports ?? []).map((s) => s.id)}
          ruleKeysBySport={ruleKeysBySport}
        />
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="font-bold">
          Score disputes{" "}
          <span className="text-sm font-normal text-muted">
            ({disputes?.length ?? 0} open)
          </span>
        </h2>
        {(disputes ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted">No open disputes.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {(disputes ?? []).map((d) => (
              <DisputeRow
                key={d.id}
                dispute={{
                  id: d.id,
                  reason: d.reason,
                  note: d.note,
                  entry:
                    (d.entries as unknown as { display_name: string })
                      ?.display_name ?? "—",
                  pool:
                    (
                      d.entries as unknown as {
                        sweepstakes: { name: string };
                      }
                    )?.sweepstakes?.name ?? "—",
                  reporter:
                    (d.profiles as unknown as { display_name: string })
                      ?.display_name ?? "—",
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="font-bold">
          Open alerts{" "}
          <span className="text-sm font-normal text-muted">
            ({alerts?.length ?? 0})
          </span>
        </h2>
        {(alerts ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted">No open alerts. 🎉</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {(alerts ?? []).map((a) => (
              <li key={a.id} className="rounded-md bg-surface-raised px-4 py-2">
                <span className="font-semibold uppercase text-brand-red">
                  {a.type}
                </span>{" "}
                <span className="text-muted">{a.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="font-bold">Latest finals</h2>
        <div className="mt-3 divide-y divide-border text-sm">
          {(recent ?? []).map((g, i) => {
            const meta = g.meta as { home_score?: number; away_score?: number } | null;
            const bc = g.broadcast as { network?: string } | null;
            return (
              <div key={i} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-bold uppercase text-info">
                    {g.sport_id}
                  </span>{" "}
                  {(g.away as unknown as { abbrev: string })?.abbrev}{" "}
                  {meta?.away_score} @{" "}
                  {(g.home as unknown as { abbrev: string })?.abbrev}{" "}
                  {meta?.home_score}
                </span>
                <span className="text-muted">
                  W: {(g.winner as unknown as { abbrev: string })?.abbrev ?? "—"}
                  {bc?.network ? ` · ${bc.network}` : ""}
                </span>
              </div>
            );
          })}
          {(recent ?? []).length === 0 && (
            <p className="py-2 text-muted">No finals ingested yet — run a sync.</p>
          )}
        </div>
      </section>
    </div>
  );
}
