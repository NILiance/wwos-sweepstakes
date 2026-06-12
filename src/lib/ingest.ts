import { createAdminClient } from "@/lib/supabase/admin";
import {
  type League,
  fetchTeams,
  fetchSeasonGames,
  fetchCurrentSeason,
} from "@/lib/sportsdata";

type Admin = ReturnType<typeof createAdminClient>;

/** Page through PostgREST's 1000-row response cap. */
async function allRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await query(i, i + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/**
 * Map provider teams onto the central teams table by abbreviation, then by
 * market/name. Unmatched rostered keys become data alerts, never silent.
 * Stores external_ref so future syncs are exact.
 */
export async function syncTeams(league: League) {
  const admin = createAdminClient();
  const provider = await fetchTeams(league);
  const { data: ours } = await admin
    .from("teams")
    .select("id,abbrev,name,market,external_ref")
    .eq("sport_id", league);

  let matched = 0;
  const norm = (s: string | null | undefined) =>
    (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const team of ours ?? []) {
    if (team.external_ref) {
      matched++;
      continue;
    }
    const hit =
      provider.find((p) => p.key.toLowerCase() === team.abbrev.toLowerCase()) ??
      provider.find(
        (p) => norm(p.name) === norm(team.name) || norm(p.market) === norm(team.market),
      ) ??
      provider.find(
        (p) => norm(p.name).includes(norm(team.name)) && norm(team.name).length > 3,
      );
    if (hit) {
      await admin
        .from("teams")
        .update({ external_ref: hit.key })
        .eq("id", team.id);
      matched++;
    }
  }
  return { league, ourTeams: ours?.length ?? 0, matched, provider: provider.length };
}

/** Upsert this season's games into the central repository. */
export async function syncGames(league: League) {
  const admin = createAdminClient();
  const season = await fetchCurrentSeason(league);
  const games = await fetchSeasonGames(league, season);

  // teams by provider key (external_ref preferred, abbrev fallback)
  const { data: ours } = await admin
    .from("teams")
    .select("id,abbrev,external_ref")
    .eq("sport_id", league);
  const byKey = new Map<string, string>();
  for (const t of ours ?? []) {
    if (t.external_ref) byKey.set(t.external_ref.toLowerCase(), t.id);
    byKey.set(t.abbrev.toLowerCase(), t.id);
  }

  let upserted = 0;
  // Dedupe within the batch — duplicate refs in one upsert chunk error out
  const uniqueGames = [...new Map(games.map((g) => [g.externalRef, g])).values()];
  const rows = uniqueGames.map((g) => {
    const home = g.homeKey ? byKey.get(g.homeKey.toLowerCase()) ?? null : null;
    const away = g.awayKey ? byKey.get(g.awayKey.toLowerCase()) ?? null : null;
    let winner: string | null = null;
    if (g.status === "final" && g.homeScore !== null && g.awayScore !== null) {
      if (g.homeScore > g.awayScore) winner = home;
      else if (g.awayScore > g.homeScore) winner = away;
    }
    return {
      sport_id: league,
      external_ref: g.externalRef,
      starts_at: g.startsAt ? new Date(g.startsAt).toISOString() : null,
      status: g.status,
      home_team_id: home,
      away_team_id: away,
      winner_team_id: winner,
      event_type: "regular",
      broadcast: g.channel ? { network: g.channel } : null,
      meta: { home_score: g.homeScore, away_score: g.awayScore, season },
      result_source: "api",
    };
  });

  // chunked upserts on (sport_id, external_ref)
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await admin
      .from("games")
      .upsert(chunk, { onConflict: "sport_id,external_ref" });
    if (error) throw new Error(`${league} games upsert: ${error.message}`);
    upserted += chunk.length;
  }
  return { league, season, games: upserted };
}

/**
 * Scoring pass: for every final game with a winner, award points to entries
 * that roster the winning team, per each sweepstakes' scoring rules
 * (sweepstakes-specific override, else platform default). Idempotent via the
 * point_events unique constraint.
 */
export async function scorePass() {
  const admin = createAdminClient();

  const { data: rules } = await admin
    .from("scoring_rules")
    .select("sweepstakes_id,sport_id,rule_key,points,scope");
  const ruleFor = (sweepstakesId: string, sport: string, key: string) => {
    const specific = rules?.find(
      (r) =>
        r.sweepstakes_id === sweepstakesId &&
        r.sport_id === sport &&
        r.rule_key === key &&
        r.scope === "full_game",
    );
    const fallback = rules?.find(
      (r) =>
        r.sweepstakes_id === null &&
        r.sport_id === sport &&
        r.rule_key === key &&
        r.scope === "full_game",
    );
    return specific ?? fallback ?? null;
  };

  // Rostered teams in active pools
  const rosters = await allRows((from, to) =>
    admin
      .from("rosters")
      .select(
        "entry_id,team_id,sport_id,entries!inner(sweepstakes_id,status,sweepstakes!inner(status))",
      )
      .range(from, to),
  );

  const active = rosters.filter((r) => {
    const e = r.entries as unknown as {
      status: string;
      sweepstakes: { status: string };
    };
    return e.status === "active" && e.sweepstakes.status === "active";
  });
  if (!active.length) return { events: 0, finals: 0 };

  const teamIds = [...new Set(active.map((r) => r.team_id))];
  const finals = await allRows((from, to) =>
    admin
      .from("games")
      .select("id,sport_id,winner_team_id,event_type")
      .eq("status", "final")
      .not("winner_team_id", "is", null)
      .in("winner_team_id", teamIds)
      .range(from, to),
  );

  // Idempotency: load already-awarded (entry, game, rule, scope) tuples.
  // (The DB unique constraint can't help — NULL reversal_of makes rows distinct.)
  const entryIds = [...new Set(active.map((r) => r.entry_id))];
  const existing = await allRows((from, to) =>
    admin
      .from("point_events")
      .select("entry_id,game_id,rule_key,scope")
      .in("entry_id", entryIds)
      .is("reversal_of", null)
      .range(from, to),
  );
  const seen = new Set(
    existing.map(
      (e) => `${e.entry_id}:${e.game_id}:${e.rule_key}:${e.scope}`,
    ),
  );

  let events = 0;
  for (const game of finals) {
    const holders = active.filter((r) => r.team_id === game.winner_team_id);
    for (const holder of holders) {
      const key = `${holder.entry_id}:${game.id}:${game.event_type}:full_game`;
      if (seen.has(key)) continue;
      const e = holder.entries as unknown as { sweepstakes_id: string };
      const rule = ruleFor(e.sweepstakes_id, game.sport_id, game.event_type);
      if (!rule) continue;
      const { error } = await admin.from("point_events").insert({
        entry_id: holder.entry_id,
        team_id: game.winner_team_id,
        game_id: game.id,
        rule_key: game.event_type,
        scope: "full_game",
        points: rule.points,
      });
      if (!error) {
        events++;
        seen.add(key);
      }
    }
  }
  return { events, finals: finals.length };
}

export async function runIngest(leagues: League[], includeGolf = true) {
  const results: Record<string, unknown> = {};
  if (includeGolf) {
    try {
      const { syncGolf } = await import("@/lib/golf");
      results.golf = await syncGolf();
    } catch (err) {
      results.golf = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  for (const league of leagues) {
    try {
      const teams = await syncTeams(league);
      const games = await syncGames(league);
      results[league] = { teams, games };
    } catch (err) {
      results[league] = { error: err instanceof Error ? err.message : String(err) };
      const admin = createAdminClient();
      await admin.from("data_alerts").insert({
        type: "provider_error",
        detail: `${league}: ${err instanceof Error ? err.message : err}`,
      });
    }
  }
  results.scoring = await scorePass();
  return results;
}
