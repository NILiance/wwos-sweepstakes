import { createAdminClient } from "@/lib/supabase/admin";

export type StandingRow = {
  id: string;
  name: string;
  total: number;
  bySport: Record<string, number>;
};

/** Full, paginated standings for a pool (PostgREST caps reads at 1000 rows). */
export async function poolStandings(
  sweepstakesId: string,
): Promise<StandingRow[]> {
  const admin = createAdminClient();
  const { data: entries } = await admin
    .from("entries")
    .select("id,display_name")
    .eq("sweepstakes_id", sweepstakesId)
    .eq("status", "active");
  if (!entries?.length) return [];

  const rows = new Map<string, StandingRow>(
    entries.map((e) => [
      e.id,
      { id: e.id, name: e.display_name, total: 0, bySport: {} },
    ]),
  );

  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("point_events")
      .select("entry_id,points,teams(sport_id)")
      .in("entry_id", entries.map((e) => e.id))
      .range(from, from + 999);
    if (!data?.length) break;
    for (const ev of data) {
      const row = rows.get(ev.entry_id);
      if (!row) continue;
      row.total += ev.points;
      const sport =
        (ev.teams as unknown as { sport_id: string })?.sport_id ?? "?";
      row.bySport[sport] = (row.bySport[sport] ?? 0) + ev.points;
    }
    if (data.length < 1000) break;
  }
  return [...rows.values()].sort((a, b) => b.total - a.total);
}

/** Paginated total + per-sport split for one entry. */
export async function entryTotals(entryId: string) {
  const admin = createAdminClient();
  let total = 0;
  const bySport: Record<string, number> = {};
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("point_events")
      .select("points,teams(sport_id)")
      .eq("entry_id", entryId)
      .range(from, from + 999);
    if (!data?.length) break;
    for (const ev of data) {
      total += ev.points;
      const sport =
        (ev.teams as unknown as { sport_id: string })?.sport_id ?? "?";
      bySport[sport] = (bySport[sport] ?? 0) + ev.points;
    }
    if (data.length < 1000) break;
  }
  return { total, bySport };
}
