import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, p, cta, SITE } from "@/lib/email";

/** ISO week key, e.g. 202624 — stable across year boundaries. */
export function isoWeek(date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400e3 + 1) / 7);
  return d.getUTCFullYear() * 100 + week;
}

async function entryTotals(sweepstakesId: string) {
  const admin = createAdminClient();
  const { data: entries } = await admin
    .from("entries")
    .select("id,display_name")
    .eq("sweepstakes_id", sweepstakesId)
    .eq("status", "active");
  if (!entries?.length) return [];

  const totals = new Map<string, number>(entries.map((e) => [e.id, 0]));
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("point_events")
      .select("entry_id,points")
      .in("entry_id", entries.map((e) => e.id))
      .range(from, from + 999);
    if (!data?.length) break;
    for (const ev of data) {
      totals.set(ev.entry_id, (totals.get(ev.entry_id) ?? 0) + ev.points);
    }
    if (data.length < 1000) break;
  }
  return entries
    .map((e) => ({ id: e.id, name: e.display_name, total: totals.get(e.id) ?? 0 }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Upsert this week's standings snapshot for every active pool, and award
 * last week's accolades once its snapshot is final.
 */
export async function takeSnapshots() {
  const admin = createAdminClient();
  const week = isoWeek();

  const { data: pools } = await admin
    .from("sweepstakes")
    .select("id")
    .eq("status", "active");

  let snapshots = 0;
  let accolades = 0;
  for (const pool of pools ?? []) {
    const ranked = await entryTotals(pool.id);
    if (!ranked.length) continue;

    const { error } = await admin.from("standings_snapshots").upsert(
      ranked.map((e, i) => ({
        sweepstakes_id: pool.id,
        entry_id: e.id,
        week,
        rank: i + 1,
        total_points: e.total,
        taken_at: new Date().toISOString(),
      })),
      { onConflict: "sweepstakes_id,entry_id,week" },
    );
    if (!error) snapshots += ranked.length;

    // Award accolades for the most recent completed week, once
    const { data: weeks } = await admin
      .from("standings_snapshots")
      .select("week")
      .eq("sweepstakes_id", pool.id)
      .lt("week", week)
      .order("week", { ascending: false })
      .limit(1);
    const lastWeek = weeks?.[0]?.week;
    if (!lastWeek) continue;

    const { data: existing } = await admin
      .from("accolades")
      .select("id")
      .eq("sweepstakes_id", pool.id)
      .eq("week", lastWeek)
      .limit(1);
    if (existing?.length) continue;

    const [{ data: lw }, { data: prior }] = await Promise.all([
      admin
        .from("standings_snapshots")
        .select("entry_id,rank,total_points")
        .eq("sweepstakes_id", pool.id)
        .eq("week", lastWeek),
      admin
        .from("standings_snapshots")
        .select("entry_id,rank,total_points,week")
        .eq("sweepstakes_id", pool.id)
        .lt("week", lastWeek)
        .order("week", { ascending: false })
        .limit(200),
    ]);
    if (!lw?.length) continue;
    const priorWeek = prior?.[0]?.week;
    const priorBy = new Map(
      (prior ?? [])
        .filter((p) => p.week === priorWeek)
        .map((p) => [p.entry_id, p]),
    );

    // Weekly high score = biggest gain over the prior snapshot
    const gains = lw.map((s) => ({
      entry_id: s.entry_id,
      gain: s.total_points - (priorBy.get(s.entry_id)?.total_points ?? 0),
      climb: (priorBy.get(s.entry_id)?.rank ?? s.rank) - s.rank,
    }));
    const high = [...gains].sort((a, b) => b.gain - a.gain)[0];
    const climber = [...gains].sort((a, b) => b.climb - a.climb)[0];

    const rows = [];
    if (high && high.gain > 0) {
      rows.push({
        sweepstakes_id: pool.id,
        entry_id: high.entry_id,
        type: "weekly_high",
        week: lastWeek,
        value: { gain: high.gain },
      });
    }
    if (climber && climber.climb > 0 && climber.entry_id !== high?.entry_id) {
      rows.push({
        sweepstakes_id: pool.id,
        entry_id: climber.entry_id,
        type: "biggest_climber",
        week: lastWeek,
        value: { spots: climber.climb },
      });
    }
    if (rows.length) {
      const { error: accErr } = await admin.from("accolades").insert(rows);
      if (!accErr) accolades += rows.length;
    }
  }
  return { week, snapshots, accolades };
}

/**
 * Weekly recap email per entrant: rank, total, movement. Intended for the
 * Monday cron run; iterates active pools.
 */
export async function sendWeeklyRecaps() {
  const admin = createAdminClient();
  const week = isoWeek();
  const { data: pools } = await admin
    .from("sweepstakes")
    .select("id,name,slug")
    .eq("status", "active");

  let sent = 0;
  for (const pool of pools ?? []) {
    const ranked = await entryTotals(pool.id);
    const { data: prevSnaps } = await admin
      .from("standings_snapshots")
      .select("entry_id,rank,total_points,week")
      .eq("sweepstakes_id", pool.id)
      .lt("week", week)
      .order("week", { ascending: false })
      .limit(200);
    const prevWeek = prevSnaps?.[0]?.week;
    const prev = new Map(
      (prevSnaps ?? []).filter((s) => s.week === prevWeek).map((s) => [s.entry_id, s]),
    );

    const { data: entries } = await admin
      .from("entries")
      .select("id,owner_user_id,display_name")
      .eq("sweepstakes_id", pool.id)
      .eq("status", "active");

    for (const entry of entries ?? []) {
      const rankIdx = ranked.findIndex((r) => r.id === entry.id);
      if (rankIdx < 0) continue;
      const me = ranked[rankIdx];
      const before = prev.get(entry.id);
      const gain = me.total - (before?.total_points ?? 0);
      const move = before ? before.rank - (rankIdx + 1) : 0;

      const { data: u } = await admin.auth.admin.getUserById(entry.owner_user_id);
      const email = u?.user?.email;
      if (!email) continue;

      const ok = await sendEmail(
        email,
        `${pool.name} weekly recap — you're in ${rankIdx + 1}${["th","st","nd","rd"][(rankIdx + 1) % 10] ?? "th"} place`,
        `Week in review: ${entry.display_name}`,
        p(`<strong>${pool.name}</strong> standings update:`) +
          p(`Rank: <strong>#${rankIdx + 1}</strong> ${move > 0 ? `(▲ up ${move})` : move < 0 ? `(▼ down ${-move})` : "(holding steady)"}`) +
          p(`Total points: <strong>${me.total}</strong> (${gain >= 0 ? "+" : ""}${gain} this week)`) +
          cta(`${SITE}/s/${pool.slug}/standings`, "Full standings & trends"),
      );
      if (ok) sent++;
    }
  }
  return { sent };
}
