// March Madness bracket model. 64 teams → 63 games in a binary-heap layout:
// node 1 = championship; children of node n are 2n and 2n+1; round-1 games
// are nodes 32–63. Winner of a node advances to floor(n/2).

export type BracketTeam = { seed: number; teamId: string; name: string };
export type BracketRegion = { name: string; teams: BracketTeam[] };
export type BracketField = {
  regions: BracketRegion[]; // 4 regions × 16 seeds
  roundNames: string[]; // index 0 = round 1 (Round of 64) … 5 = Championship
  roundPoints: number[];
};

export const DEFAULT_ROUND_NAMES = [
  "Round of 64",
  "Round of 32",
  "Sweet 16",
  "Elite 8",
  "Final Four",
  "Championship",
];
export const DEFAULT_ROUND_POINTS = [1, 2, 4, 8, 16, 32];

// Standard 16-team region seeding order (game by game)
const SEED_ORDER: [number, number][] = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
];

/** Round number (1–6) of a game node. */
export function roundOfNode(node: number): number {
  return 6 - Math.floor(Math.log2(node));
}

/** All 63 node ids, deepest round first (round 1 nodes 32–63 … node 1). */
export function allNodes(): number[] {
  return Array.from({ length: 63 }, (_, i) => 63 - i);
}

/**
 * First-round matchups by node (32–63). Region r occupies nodes 32+8r … 39+8r,
 * each game seeded per SEED_ORDER.
 */
export function firstRoundMatchups(
  field: BracketField,
): Record<number, { a: BracketTeam; b: BracketTeam }> {
  const out: Record<number, { a: BracketTeam; b: BracketTeam }> = {};
  field.regions.forEach((region, r) => {
    const bySeed = new Map(region.teams.map((t) => [t.seed, t]));
    SEED_ORDER.forEach(([sa, sb], g) => {
      const node = 32 + r * 8 + g;
      const a = bySeed.get(sa);
      const b = bySeed.get(sb);
      if (a && b) out[node] = { a, b };
    });
  });
  return out;
}

/** Build a field from a flat 64-team list (4 regions of 16, seeded in order). */
export function buildField(
  teams: { teamId: string; name: string }[],
  regionNames = ["East", "West", "South", "Midwest"],
  roundPoints = DEFAULT_ROUND_POINTS,
): BracketField {
  const regions: BracketRegion[] = regionNames.map((name, r) => ({
    name,
    teams: teams.slice(r * 16, r * 16 + 16).map((t, i) => ({
      seed: i + 1,
      teamId: t.teamId,
      name: t.name,
    })),
  }));
  return { regions, roundNames: DEFAULT_ROUND_NAMES, roundPoints };
}

/** Team ids in deterministic node order (for client option resolution). */
export function nodeTeams(
  field: BracketField,
  picks: Record<number, string>,
): Record<number, { a: string | null; b: string | null }> {
  const fr = firstRoundMatchups(field);
  const out: Record<number, { a: string | null; b: string | null }> = {};
  // round 1
  for (let n = 32; n <= 63; n++) {
    out[n] = { a: fr[n]?.a.teamId ?? null, b: fr[n]?.b.teamId ?? null };
  }
  // higher rounds resolve from children picks
  for (let n = 31; n >= 1; n--) {
    out[n] = { a: picks[2 * n] ?? null, b: picks[2 * n + 1] ?? null };
  }
  return out;
}
