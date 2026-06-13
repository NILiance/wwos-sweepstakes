"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { roundOfNode } from "@/lib/bracket";

export async function saveBracket(input: {
  picks: Record<number, string>;
  tiebreaker: number | null;
}): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const slug = "";
  void slug;
  // Resolve which entry this user owns in a bracket-mode pool from the picks'
  // sweepstakes is implicit; we pass via a hidden mechanism — instead look up
  // the user's active bracket-mode entry that is still open.
  const admin = createAdminClient();
  const { data: entries } = await admin
    .from("entries")
    .select("id,sweepstakes_id,sweepstakes!inner(status,game_mode,draw_at)")
    .eq("owner_user_id", user.id)
    .eq("status", "active");
  const entry = (entries ?? []).find(
    (e) =>
      (e.sweepstakes as unknown as { game_mode: string }).game_mode === "bracket",
  );
  if (!entry) return { ok: false, message: "No open bracket entry found." };

  const sw = entry.sweepstakes as unknown as { status: string; draw_at: string | null };
  const locked =
    sw.status !== "enrolling" ||
    (!!sw.draw_at && new Date(sw.draw_at) <= new Date());
  if (locked) return { ok: false, message: "Picks are locked." };

  // Find or create this entry's bracket
  let { data: bracket } = await admin
    .from("brackets")
    .select("id")
    .eq("entry_id", entry.id)
    .maybeSingle();
  if (!bracket) {
    const { data: created, error } = await admin
      .from("brackets")
      .insert({
        sweepstakes_id: entry.sweepstakes_id,
        entry_id: entry.id,
        tiebreaker_total: input.tiebreaker,
      })
      .select("id")
      .single();
    if (error) return { ok: false, message: error.message };
    bracket = created;
  } else {
    await admin
      .from("brackets")
      .update({ tiebreaker_total: input.tiebreaker })
      .eq("id", bracket.id);
  }

  // Replace picks
  await admin.from("bracket_picks").delete().eq("bracket_id", bracket.id);
  const rows = Object.entries(input.picks)
    .filter(([, tid]) => !!tid)
    .map(([slot, tid]) => ({
      bracket_id: bracket!.id,
      slot: Number(slot),
      round: roundOfNode(Number(slot)),
      picked_team_id: tid,
      result: "pending",
    }));
  if (rows.length) {
    const { error } = await admin.from("bracket_picks").insert(rows);
    if (error) return { ok: false, message: error.message };
  }

  return { ok: true, message: "Bracket saved!" };
}
