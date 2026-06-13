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

/** Upsert this season's games (regular + postseason) into the central repo. */
export async function syncGames(league: League) {
  const admin = createAdminClient();
  const season = await fetchCurrentSeason(league);

  // Always try the postseason companion — empty until it exists
  const base = String(season).replace(/(REG|POST|OFF)$/i, "");
  const seasons = [...new Set([String(season), `${base}POST`])];
  const games = [];
  for (const s of seasons) {
    try {
      games.push(...(await fetchSeasonGames(league, s)));
    } catch {
      // postseason feed may 404 before it exists — fine
    }
  }

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

  // Don't clobber admin-corrected games on re-sync
  const manualRefs = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("games")
      .select("external_ref")
      .eq("sport_id", league)
      .eq("result_source", "manual")
      .range(from, from + 999);
    if (!data?.length) break;
    data.forEach((g) => g.external_ref && manualRefs.add(g.external_ref));
    if (data.length < 1000) break;
  }

  let upserted = 0;
  // Dedupe within the batch — duplicate refs in one upsert chunk error out
  const uniqueGames = [
    ...new Map(games.map((g) => [g.externalRef, g])).values(),
  ].filter((g) => !manualRefs.has(g.externalRef));
  const halfUpdates: { ref: string; line_score: object }[] = [];
  const rows = uniqueGames.map((g) => {
    const home = g.homeKey ? byKey.get(g.homeKey.toLowerCase()) ?? null : null;
    const away = g.awayKey ? byKey.get(g.awayKey.toLowerCase()) ?? null : null;
    let winner: string | null = null;
    if (g.status === "final" && g.homeScore !== null && g.awayScore !== null) {
      if (g.homeScore > g.awayScore) winner = home;
      else if (g.awayScore > g.homeScore) winner = away;
    }
    const h1 = g.half1WinnerKey ? byKey.get(g.half1WinnerKey.toLowerCase()) ?? null : null;
    const h2 = g.half2WinnerKey ? byKey.get(g.half2WinnerKey.toLowerCase()) ?? null : null;
    // line_score is NOT in the bulk upsert (would null-clobber computed/manual
    // values for feeds without quarters); applied as targeted updates below.
    if (h1 || h2)
      halfUpdates.push({
        ref: g.externalRef,
        line_score: { half1_winner_team_id: h1, half2_winner_team_id: h2 },
      });
    return {
      sport_id: league,
      external_ref: g.externalRef,
      starts_at: g.startsAt ? new Date(g.startsAt).toISOString() : null,
      status: g.status,
      home_team_id: home,
      away_team_id: away,
      winner_team_id: winner,
      event_type: g.eventType,
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

  // Targeted half-winner updates (only where quarters yielded a result)
  for (const u of halfUpdates) {
    await admin
      .from("games")
      .update({ line_score: u.line_score })
      .eq("sport_id", league)
      .eq("external_ref", u.ref);
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
  const ruleFor = (
    sweepstakesId: string,
    sport: string,
    key: string,
    scope = "full_game",
  ) => {
    const specific = rules?.find(
      (r) =>
        r.sweepstakes_id === sweepstakesId &&
        r.sport_id === sport &&
        r.rule_key === key &&
        r.scope === scope,
    );
    const fallback = rules?.find(
      (r) =>
        r.sweepstakes_id === null &&
        r.sport_id === sport &&
        r.rule_key === key &&
        r.scope === scope,
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
      .select("id,sport_id,winner_team_id,event_type,line_score")
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
  // One award per (entry, game, scope) — rule_key omitted so a later
  // event_type refinement (regular → wildcard) can't double-award.
  const seen = new Set(
    existing.map((e) => `${e.entry_id}:${e.game_id}:${e.scope}`),
  );

  let events = 0;
  // Award definition: a (winning team, scope, rule_key) for a game
  for (const game of finals) {
    const ls = (game.line_score ?? {}) as {
      half1_winner_team_id?: string | null;
      half2_winner_team_id?: string | null;
    };
    const awards: { teamId: string; scope: string; ruleKey: string }[] = [
      { teamId: game.winner_team_id, scope: "full_game", ruleKey: game.event_type },
    ];
    // Half wins use the 'regular' rule key at half1/half2 scope (config option)
    if (ls.half1_winner_team_id)
      awards.push({ teamId: ls.half1_winner_team_id, scope: "half1", ruleKey: "regular" });
    if (ls.half2_winner_team_id)
      awards.push({ teamId: ls.half2_winner_team_id, scope: "half2", ruleKey: "regular" });

    for (const a of awards) {
      const holders = active.filter((r) => r.team_id === a.teamId);
      for (const holder of holders) {
        const key = `${holder.entry_id}:${game.id}:${a.scope}`;
        if (seen.has(key)) continue;
        const e = holder.entries as unknown as { sweepstakes_id: string };
        const rule = ruleFor(e.sweepstakes_id, game.sport_id, a.ruleKey, a.scope);
        if (!rule || rule.points === 0) continue;
        const { error } = await admin.from("point_events").insert({
          entry_id: holder.entry_id,
          team_id: a.teamId,
          game_id: game.id,
          rule_key: a.scope === "full_game" ? a.ruleKey : `${a.ruleKey}_${a.scope}`,
          scope: a.scope,
          points: rule.points,
        });
        if (!error) {
          events++;
          seen.add(key);
        }
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
  try {
    const { takeSnapshots } = await import("@/lib/snapshots");
    results.snapshots = await takeSnapshots();
  } catch (err) {
    results.snapshots = {
      error: err instanceof Error ? err.message : String(err),
    };
  }
  return results;
}
