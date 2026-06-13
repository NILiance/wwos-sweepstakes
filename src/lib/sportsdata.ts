// SportsDataIO provider — feeds the central sports data repository.
// All leagues share the Scores API shape with per-league field quirks,
// normalized here so ingestion stays provider-agnostic downstream.

export type League = "nfl" | "cfb" | "nba" | "cbb" | "nhl" | "mlb" | "wnba";

export const LEAGUES: League[] = ["nfl", "cfb", "nba", "cbb", "nhl", "mlb", "wnba"];

const BASE = "https://api.sportsdata.io/v3";

async function sdio<T>(path: string): Promise<T> {
  const key = process.env.SPORTS_API_KEY;
  if (!key) throw new Error("SPORTS_API_KEY not set");
  const res = await fetch(`${BASE}${path}${path.includes("?") ? "&" : "?"}key=${key}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SportsDataIO ${path}: ${res.status}`);
  return res.json();
}

export type ProviderTeam = {
  key: string; // provider abbreviation
  externalId: string;
  name: string;
  market: string | null;
};

type RawTeam = {
  Key?: string;
  TeamID?: number;
  GlobalTeamID?: number;
  School?: string;
  Name?: string;
  City?: string;
  Active?: boolean;
};

export async function fetchTeams(league: League): Promise<ProviderTeam[]> {
  const data = await sdio<RawTeam[]>(`/${league}/scores/json/teams`);
  return data
    .filter((t) => t.Key)
    .map((t) => ({
      key: String(t.Key),
      externalId: String(t.TeamID ?? t.GlobalTeamID ?? t.Key),
      name: t.School ?? [t.City, t.Name].filter(Boolean).join(" ") ?? String(t.Key),
      market: t.City ?? t.School ?? null,
    }));
}

export type ProviderGame = {
  externalRef: string;
  startsAt: string | null;
  status: "scheduled" | "live" | "final" | "postponed" | "canceled" | "suspended";
  homeKey: string | null;
  awayKey: string | null;
  homeScore: number | null;
  awayScore: number | null;
  channel: string | null;
  eventType: string; // scoring rule_key ('regular', 'wildcard', 'sugar_bowl', …)
  raw?: unknown;
};

/** Map a postseason game to its scoring rule_key where deterministic. */
function eventTypeFor(
  league: League,
  isPost: boolean,
  week: unknown,
  title: unknown,
): string {
  if (!isPost) return "regular";
  if (league === "nfl") {
    const w = Number(week);
    return (
      { 1: "wildcard", 2: "divisional", 3: "conf_champ", 4: "super_bowl" }[w] ??
      "wildcard"
    );
  }
  if (league === "cfb") {
    const t = String(title ?? "").toLowerCase();
    if (t.includes("national championship") || t.includes("cfp championship"))
      return "championship";
    for (const bowl of ["sugar", "peach", "fiesta", "rose", "cotton", "orange"]) {
      if (t.includes(bowl)) return `${bowl}_bowl`;
    }
    if (t.includes("first round") || t.includes("playoff")) return "playoff_r1";
    return "bowl";
  }
  // NBA/NHL/MLB/WNBA: basic feeds don't carry the round — score as round 1
  // until the manual console / series mapping refines it (meta keeps raw info)
  return league === "mlb" ? "wildcard" : "playoff_r1";
}

type RawGame = Record<string, unknown>;

function normalizeStatus(s: unknown): ProviderGame["status"] {
  const v = String(s ?? "").toLowerCase();
  if (v.startsWith("final") || v === "f/ot" || v === "f/so" || v === "closed")
    return "final";
  if (v === "inprogress" || v === "in progress" || v === "live") return "live";
  if (v === "postponed") return "postponed";
  if (v === "canceled" || v === "cancelled") return "canceled";
  if (v === "suspended") return "suspended";
  return "scheduled";
}

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

export async function fetchSeasonGames(
  league: League,
  season: string | number,
): Promise<ProviderGame[]> {
  // NFL uses /Schedules, others use /Games
  const path =
    league === "nfl"
      ? `/nfl/scores/json/Schedules/${season}`
      : `/${league}/scores/json/Games/${season}`;
  const data = await sdio<RawGame[]>(path);
  const isPost = String(season).toUpperCase().includes("POST");
  return data
    .filter(
      (g) =>
        g["HomeTeam"] &&
        g["AwayTeam"] &&
        // NFL schedules include bye-week placeholder rows with no game key
        g["HomeTeam"] !== "BYE" &&
        g["AwayTeam"] !== "BYE" &&
        (g["GameKey"] ?? g["GameID"] ?? g["GlobalGameID"] ?? g["ScoreID"]) != null,
    )
    .map((g) => ({
      externalRef: String(
        g["GameKey"] ?? g["GameID"] ?? g["GlobalGameID"] ?? g["ScoreID"],
      ),
      startsAt: (g["DateTime"] ?? g["Day"] ?? null) as string | null,
      status: normalizeStatus(g["Status"]),
      homeKey: String(g["HomeTeam"]),
      awayKey: String(g["AwayTeam"]),
      homeScore:
        num(g["HomeTeamRuns"]) ?? num(g["HomeTeamScore"]) ?? num(g["HomeScore"]),
      awayScore:
        num(g["AwayTeamRuns"]) ?? num(g["AwayTeamScore"]) ?? num(g["AwayScore"]),
      channel: (g["Channel"] as string) ?? null,
      eventType: eventTypeFor(league, isPost, g["Week"], g["Title"]),
    }));
}

export async function fetchCurrentSeason(league: League): Promise<string> {
  // NFL/CFB: numeric or object; others: object with Season or plain number
  const data = await sdio<unknown>(`/${league}/scores/json/CurrentSeason`);
  if (typeof data === "number" || typeof data === "string") return String(data);
  const obj = data as { Season?: number; ApiSeason?: string };
  return String(obj.ApiSeason ?? obj.Season ?? new Date().getFullYear());
}
