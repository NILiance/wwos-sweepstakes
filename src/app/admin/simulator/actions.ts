"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const SIM_SLUG = "draw-simulator";
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

export async function resetSimulator(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const ctx = await requireStaff("simulator");
    const admin = createAdminClient();
    const simUserId = await getSimUserId(admin);

    // Find or create the simulator pool (private, hidden from browse)
    let { data: sim } = await admin
      .from("sweepstakes")
      .select("id")
      .eq("slug", SIM_SLUG)
      .maybeSingle();

    if (!sim) {
      const { data: created, error } = await admin
        .from("sweepstakes")
        .insert({
          name: "Draw Simulator",
          slug: SIM_SLUG,
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
      message: "Simulator ready — 15 entries seeded. Run the draw!",
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Reset failed.",
    };
  }
}
