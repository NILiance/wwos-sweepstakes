"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDraw, finishDrawNow } from "@/lib/draw";
import { scorePass } from "@/lib/ingest";

const SIM_SLUG = "draw-simulator";
const REHEARSAL_SLUG = "draw-rehearsal";
const SIM_EMAIL = "simulator@wwossweepstakes.com";

// The original WWOS 4 field — familiar names make the simulation feel real
const FIELD = [
  "Scott K", "Greg O", "Paul E", "Jeff H", "Rob W",
  "Ken L", "Matt M", "Tom H", "Scott S", "Team El Toro",
  "Josh D", "Dustin/JB", "Team GO", "Lance/Jack", "Urim B",
];

async function getSimUserId(admin: ReturnType<typeof createAdminClient>) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: SIM_EMAIL,
    email_confirm: true,
    user_metadata: { display_name: "Simulator" },
  });
  if (created?.user) return created.user.id;
  if (error?.message.toLowerCase().includes("already")) {
    const { data: list } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const existing = list?.users.find((u) => u.email === SIM_EMAIL);
    if (existing) return existing.id;
  }
  throw new Error(error?.message ?? "Could not provision simulator user");
}

async function wipeSimPool(
  admin: ReturnType<typeof createAdminClient>,
  simId: string,
) {
  const { data: entries } = await admin
    .from("entries")
    .select("id")
    .eq("sweepstakes_id", simId);
  const entryIds = (entries ?? []).map((e) => e.id);
  if (entryIds.length) {
    await admin.from("rosters").delete().in("entry_id", entryIds);
    await admin.from("point_events").delete().in("entry_id", entryIds);
  }
  const { data: draws } = await admin
    .from("draws")
    .select("id")
    .eq("sweepstakes_id", simId);
  for (const d of draws ?? []) {
    await admin.from("draw_picks").delete().eq("draw_id", d.id);
  }
  await admin.from("draws").delete().eq("sweepstakes_id", simId);
  await admin.from("entries").delete().eq("sweepstakes_id", simId);
}

async function resetPool(slug: string, name: string): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const ctx = await requireStaff("simulator");
    const admin = createAdminClient();
    const simUserId = await getSimUserId(admin);

    // Find or create the practice pool (private, hidden from browse)
    let { data: sim } = await admin
      .from("sweepstakes")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!sim) {
      const { data: created, error } = await admin
        .from("sweepstakes")
        .insert({
          name,
          slug,
          description: "Practice run — not a real pool.",
          season_label: "Simulation",
          visibility: "private",
          status: "enrolling",
          pool_size: 15,
          entry_price_cents: 0,
          payout_structure: [
            { place: 1, amount_cents: 1000000 },
            { place: 2, amount_cents: 250000 },
            { place: 3, amount_cents: 150000 },
            { place: 4, amount_cents: 100000 },
          ],
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      sim = created;

      // Mirror the flagship roster composition
      const config = [
        ["cfb", 4], ["nfl", 2], ["cbb", 4], ["nba", 2],
        ["nhl", 2], ["pga", 3], ["liv", 1], ["mlb", 2],
      ] as const;
      const { error: cfgErr } = await admin.from("sweepstakes_sports").insert(
        config.map(([sport_id, picks_per_entry]) => ({
          sweepstakes_id: sim!.id,
          sport_id,
          picks_per_entry,
          pool_source: "all",
        })),
      );
      if (cfgErr) throw new Error(cfgErr.message);
    } else {
      await wipeSimPool(admin, sim.id);
      await admin
        .from("sweepstakes")
        .update({ status: "enrolling" })
        .eq("id", sim.id);
    }

    // Seed the full 15-entry field
    const { error: entryErr } = await admin.from("entries").insert(
      FIELD.map((name) => ({
        sweepstakes_id: sim!.id,
        owner_user_id: simUserId,
        display_name: name,
        status: "active",
        source: "admin",
      })),
    );
    if (entryErr) throw new Error(entryErr.message);

    await admin
      .from("sweepstakes")
      .update({ status: "full" })
      .eq("id", sim.id);

    await admin.from("audit_log").insert({
      actor: ctx.userId,
      action: "simulator.reset",
      target: sim.id,
    });

    revalidatePath("/admin/simulator");
    return {
      ok: true,
      message: `${name} ready — 15 entries seeded. Run the draw!`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Reset failed.",
    };
  }
}

export async function resetSimulator() {
  return resetPool(SIM_SLUG, "Draw Simulator");
}

/** Separate practice pool just for live-draw rehearsal — leaves the
 *  populated preview pool untouched. */
export async function resetRehearsal() {
  return resetPool(REHEARSAL_SLUG, "Draw Rehearsal");
}

const CHATTER: [number, string][] = [
  [0, "Drew two playoff teams. It's over for the rest of you. 🏆"],
  [4, "Whoever invented random draws owes me a refund"],
  [2, "My golf picks better start earning their keep"],
  [7, "Checking the standings hourly is my cardio"],
  [11, "Talk to me after football season starts 😤"],
  [1, "The board is quiet because you're all scared"],
];

/**
 * One-click end-to-end preview: fresh field → instant draw → score from
 * real ingested finals → seeded chatter. Standings, rosters, upcoming
 * games and the board all populate with live data.
 */
export async function instantPreview(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    // Fresh field first (also creates the pool on first run)
    const reset = await resetSimulator();
    if (!reset.ok) return reset;

    const admin = createAdminClient();
    const { data: sim } = await admin
      .from("sweepstakes")
      .select("id")
      .eq("slug", "draw-simulator")
      .single();
    if (!sim) return { ok: false, message: "Simulator pool missing." };

    await runDraw(sim.id);
    const done = await finishDrawNow(sim.id);
    const scored = await scorePass();

    // Seed smack talk from the entries themselves
    const { data: entries } = await admin
      .from("entries")
      .select("id,owner_user_id,display_name")
      .eq("sweepstakes_id", sim.id)
      .order("created_at");
    if (entries?.length) {
      const base = Date.now() - CHATTER.length * 3600e3;
      await admin.from("posts").insert(
        CHATTER.map(([idx, body], i) => ({
          sweepstakes_id: sim.id,
          user_id: entries[idx % entries.length].owner_user_id,
          body: `${entries[idx % entries.length].display_name}: ${body}`,
          created_at: new Date(base + i * 3600e3).toISOString(),
        })),
      );
    }

    revalidatePath("/admin/simulator");
    return {
      ok: true,
      message: `Preview live — ${done.ok ? done.picks : 0} picks drawn, ${scored.events} point events scored from real games. Open the pool pages!`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Preview failed.",
    };
  }
}
