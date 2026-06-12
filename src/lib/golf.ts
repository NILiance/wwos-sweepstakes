import { createAdminClient } from "@/lib/supabase/admin";

// SportsDataIO Golf v2 — tournaments + leaderboards. A finished tournament
// becomes one "game" row whose winner is the rank-1 player, attributed to
// the golfer's sport (pga or liv) in the central repository.

const BASE = "https://api.sportsdata.io/golf/v2/json";

async function golf<T>(path: string): Promise<T> {
  const key = process.env.SPORTS_API_KEY;
  if (!key) throw new Error("SPORTS_API_KEY not set");
  const res = await fetch(`${BASE}${path}?key=${key}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Golf API ${path}: ${res.status}`);
  return res.json();
}

type Tournament = {
  TournamentID: number;
  Name: string;
  StartDate: string;
  EndDate: string | null;
  IsOver: boolean;
};

type LeaderboardPlayer = {
  Name?: string;
  Rank?: number | null;
  TotalScore?: number | null;
};

/** "S Scheffler" / "Scottie Scheffler" → "s scheffler" matching key. */
function golferKey(name: string): string {
  const parts = name.trim().toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0][0]} ${parts[parts.length - 1]}`;
}

export async function syncGolf() {
  const admin = createAdminClient();
  const year = new Date().getFullYear();

  const tournaments = await golf<Tournament[]>("/Tournaments");
  const finished = tournaments.filter(
    (t) => t.IsOver && new Date(t.StartDate).getFullYear() === year,
  );

  // Our golfers keyed for matching
  const { data: golfers } = await admin
    .from("teams")
    .select("id,name,sport_id")
    .in("sport_id", ["pga", "liv"]);
  const byKey = new Map(
    (golfers ?? []).map((g) => [golferKey(g.name), g]),
  );

  // Skip tournaments already ingested
  const { data: existing } = await admin
    .from("games")
    .select("external_ref")
    .in("sport_id", ["pga", "liv"]);
  const seen = new Set((existing ?? []).map((g) => g.external_ref));

  let created = 0;
  let unmatchedWinners = 0;
  for (const t of finished) {
    const ref = `golf-${t.TournamentID}`;
    if (seen.has(ref)) continue;

    let players: LeaderboardPlayer[] = [];
    try {
      const lb = await golf<{ Players?: LeaderboardPlayer[] }>(
        `/Leaderboard/${t.TournamentID}`,
      );
      players = lb.Players ?? [];
    } catch {
      continue; // leaderboard unavailable — pick it up on a later sync
    }
    const winner = players
      .filter((p) => p.Name && p.Rank != null)
      .sort((a, b) => (a.Rank ?? 99) - (b.Rank ?? 99))[0];
    if (!winner?.Name) continue;

    const golfer = byKey.get(golferKey(winner.Name));
    if (!golfer) {
      unmatchedWinners++; // winner not in any draw pool — nothing to score
      continue;
    }

    const { error } = await admin.from("games").insert({
      sport_id: golfer.sport_id,
      external_ref: ref,
      starts_at: t.StartDate ? new Date(t.StartDate).toISOString() : null,
      status: "final",
      winner_team_id: golfer.id,
      event_type: "regular",
      meta: { tournament: t.Name, winner: winner.Name },
      result_source: "api",
    });
    if (!error) created++;
  }

  return {
    finished: finished.length,
    created,
    unmatchedWinners,
  };
}
