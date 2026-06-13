"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildField } from "@/lib/bracket";

/** Generate a 64-team field from the top CBB teams (admin can refine later). */
export async function generateBracketField(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireStaff("sweepstakes");
    const sweepstakesId = String(formData.get("sweepstakes_id"));
    const admin = createAdminClient();

    const { data: teams } = await admin
      .from("teams")
      .select("id,name,abbrev")
      .eq("sport_id", "cbb")
      .eq("active", true)
      .order("name")
      .limit(64);
    if (!teams || teams.length < 64) {
      return {
        ok: false,
        message: `Need 64 college-basketball teams in the pool; only ${teams?.length ?? 0} available.`,
      };
    }
    const field = buildField(
      teams.map((t) => ({ teamId: t.id, name: t.abbrev || t.name })),
    );
    await admin
      .from("sweepstakes")
      .update({ bracket_field: field })
      .eq("id", sweepstakesId);

    // Ensure a truth bracket exists
    const { data: truth } = await admin
      .from("brackets")
      .select("id")
      .eq("sweepstakes_id", sweepstakesId)
      .eq("is_truth", true)
      .maybeSingle();
    if (!truth) {
      await admin.from("brackets").insert({
        sweepstakes_id: sweepstakesId,
        entry_id: null,
        is_truth: true,
      });
    }

    revalidatePath(`/admin/sweepstakes/${sweepstakesId}/bracket`);
    revalidatePath(`/s`, "layout");
    return { ok: true, message: "64-team field generated. Refine seeds/regions as needed." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

/** Advance the truth bracket: record the real winner of a game node. */
export async function setTruthWinner(formData: FormData): Promise<void> {
  await requireStaff("sweepstakes");
  const sweepstakesId = String(formData.get("sweepstakes_id"));
  const slot = Number(formData.get("slot"));
  const round = Number(formData.get("round"));
  const teamId = String(formData.get("team_id"));
  const admin = createAdminClient();

  const { data: truth } = await admin
    .from("brackets")
    .select("id")
    .eq("sweepstakes_id", sweepstakesId)
    .eq("is_truth", true)
    .single();
  if (!truth) return;

  await admin.from("bracket_picks").upsert(
    {
      bracket_id: truth.id,
      slot,
      round,
      picked_team_id: teamId,
      result: "hit",
    },
    { onConflict: "bracket_id,slot" },
  );
  revalidatePath(`/admin/sweepstakes/${sweepstakesId}/bracket`);
  revalidatePath(`/s`, "layout");
}
