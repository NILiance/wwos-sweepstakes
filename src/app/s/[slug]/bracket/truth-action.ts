"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

/** Persist a single truth-bracket winner (admin live advancement). */
export async function setTruthWinnerClient(
  sweepstakesId: string,
  slot: number,
  round: number,
  teamId: string,
): Promise<{ ok: boolean }> {
  await requireStaff("sweepstakes");
  const admin = createAdminClient();
  const { data: truth } = await admin
    .from("brackets")
    .select("id")
    .eq("sweepstakes_id", sweepstakesId)
    .eq("is_truth", true)
    .single();
  if (!truth) return { ok: false };
  await admin.from("bracket_picks").upsert(
    { bracket_id: truth.id, slot, round, picked_team_id: teamId, result: "hit" },
    { onConflict: "bracket_id,slot" },
  );
  revalidatePath(`/s`, "layout");
  return { ok: true };
}
