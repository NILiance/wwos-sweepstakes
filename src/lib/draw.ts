import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Provably fair draw (SCOPE §4.5):
 * - seed generated server-side; sha256(seed) stored at draw creation
 * - all shuffles derive deterministically from the seed, so publishing the
 *   seed afterward lets anyone replay and verify every assignment
 */

function seededShuffle<T>(arr: T[], seed: string, tag: string): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const h = createHash("sha256").update(`${seed}:${tag}:${i}`).digest();
    const j = h.readUInt32BE(0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function broadcast(topic: string, event: string, payload: unknown) {
  await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages: [{ topic, event, payload }] }),
  });
}

export async function runDraw(sweepstakesId: string) {
  const admin = createAdminClient();

  const [{ data: sw }, { data: entries }, { data: config }] =
    await Promise.all([
      admin
        .from("sweepstakes")
        .select("id,slug,status")
        .eq("id", sweepstakesId)
        .single(),
      admin
        .from("entries")
        .select("id,display_name")
        .eq("sweepstakes_id", sweepstakesId)
        .eq("status", "active")
        .order("created_at"),
      admin
        .from("sweepstakes_sports")
        .select("sport_id,picks_per_entry,sports(name,short_name,sort_order)")
        .eq("sweepstakes_id", sweepstakesId),
    ]);

  if (!sw) throw new Error("Sweepstakes not found");
  if (!["enrolling", "full"].includes(sw.status))
    throw new Error(`Cannot draw from status "${sw.status}"`);
  if (!entries?.length) throw new Error("No active entries");
  if (!config?.length) throw new Error("No sports configured");

  // Existing non-voided draw?
  const { data: priorDraw } = await admin
    .from("draws")
    .select("id")
    .eq("sweepstakes_id", sweepstakesId)
    .neq("status", "voided")
    .maybeSingle();
  if (priorDraw) throw new Error("A draw already exists for this pool");

  const seed = randomBytes(32).toString("hex");
  const seedHash = createHash("sha256").update(seed).digest("hex");

  const sportsOrdered = [...config].sort(
    (a, b) =>
      ((a.sports as unknown as { sort_order: number })?.sort_order ?? 0) -
      ((b.sports as unknown as { sort_order: number })?.sort_order ?? 0),
  );

  // Build assignments
  const entryOrder = seededShuffle(entries, seed, "entries");
  const picks: { entry_id: string; team_id: string; sequence: number }[] = [];
  let sequence = 1;

  for (const sc of sportsOrdered) {
    const { data: pool } = await admin
      .from("teams")
      .select("id")
      .eq("sport_id", sc.sport_id)
      .eq("active", true);
    const need = entryOrder.length * sc.picks_per_entry;
    if (!pool || pool.length < need) {
      throw new Error(
        `Not enough ${sc.sport_id} teams: need ${need}, have ${pool?.length ?? 0}`,
      );
    }
    const shuffled = seededShuffle(pool, seed, `pool:${sc.sport_id}`);
    for (let round = 0; round < sc.picks_per_entry; round++) {
      for (let e = 0; e < entryOrder.length; e++) {
        picks.push({
          entry_id: entryOrder[e].id,
          team_id: shuffled[round * entryOrder.length + e].id,
          sequence: sequence++,
        });
      }
    }
  }

  // Persist: draw, picks, rosters; flip status
  const { data: draw, error: drawErr } = await admin
    .from("draws")
    .insert({
      sweepstakes_id: sweepstakesId,
      seed_hash: seedHash,
      seed: null, // revealed at completion
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (drawErr) throw new Error(drawErr.message);

  const { error: picksErr } = await admin.from("draw_picks").insert(
    picks.map((p) => ({ ...p, draw_id: draw.id })),
  );
  if (picksErr) throw new Error(picksErr.message);

  await admin
    .from("sweepstakes")
    .update({ status: "drawing" })
    .eq("id", sweepstakesId);

  // Store seed privately until completion (audit log holds it for admin)
  await admin.from("audit_log").insert({
    action: "draw.created",
    target: draw.id,
    detail: { sweepstakes_id: sweepstakesId, seed_hash: seedHash, seed },
  });

  await broadcast(`draw:${sweepstakesId}`, "started", {
    drawId: draw.id,
    totalPicks: picks.length,
  });

  return { drawId: draw.id, totalPicks: picks.length };
}

export async function revealNextPick(sweepstakesId: string) {
  const admin = createAdminClient();

  const { data: draw } = await admin
    .from("draws")
    .select("id,status")
    .eq("sweepstakes_id", sweepstakesId)
    .eq("status", "running")
    .maybeSingle();
  if (!draw) return { done: true as const };

  const { data: next } = await admin
    .from("draw_picks")
    .select(
      "id,sequence,entry_id,entries(display_name),team_id,teams(name,abbrev,sport_id,sports(short_name,name))",
    )
    .eq("draw_id", draw.id)
    .is("revealed_at", null)
    .order("sequence")
    .limit(1)
    .maybeSingle();

  if (!next) {
    // Complete: reveal seed, materialize rosters, activate pool
    const { data: audit } = await admin
      .from("audit_log")
      .select("detail")
      .eq("action", "draw.created")
      .eq("target", draw.id)
      .single();
    const seed = (audit?.detail as { seed?: string })?.seed ?? null;

    const { data: allPicks } = await admin
      .from("draw_picks")
      .select("entry_id,team_id,teams(sport_id)")
      .eq("draw_id", draw.id);
    if (allPicks?.length) {
      await admin.from("rosters").upsert(
        allPicks.map((p) => ({
          entry_id: p.entry_id,
          team_id: p.team_id,
          sport_id: (p.teams as unknown as { sport_id: string }).sport_id,
        })),
        { onConflict: "entry_id,team_id" },
      );
    }
    await admin
      .from("draws")
      .update({ status: "completed", seed, completed_at: new Date().toISOString() })
      .eq("id", draw.id);
    await admin
      .from("sweepstakes")
      .update({ status: "active" })
      .eq("id", sweepstakesId);
    await broadcast(`draw:${sweepstakesId}`, "complete", { seed });
    return { done: true as const };
  }

  await admin
    .from("draw_picks")
    .update({ revealed_at: new Date().toISOString() })
    .eq("id", next.id);

  const teams = next.teams as unknown as {
    name: string;
    abbrev: string;
    sport_id: string;
    sports: { short_name: string | null; name: string };
  };
  const payload = {
    sequence: next.sequence,
    entryId: next.entry_id,
    entryName: (next.entries as unknown as { display_name: string })
      .display_name,
    team: teams.name,
    abbrev: teams.abbrev,
    sport: teams.sports.short_name ?? teams.sports.name,
    sportId: teams.sport_id,
  };
  await broadcast(`draw:${sweepstakesId}`, "pick", payload);
  return { done: false as const, pick: payload };
}
