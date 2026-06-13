"use server";

import { revalidatePath } from "next/cache";
import { requireLeagueAccess } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Set a custom draw pool for one sport from a pasted list (one team/golfer per
 * line). Lines match existing teams by abbrev or name; unmatched lines create
 * a new team for that sport (handy for golfer fields). Empty list = use auto.
 */
export async function saveSportPool(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const sweepstakesId = String(formData.get("sweepstakes_id"));
    await requireLeagueAccess(sweepstakesId);
    const sport = String(formData.get("sport_id"));
    const lines = String(formData.get("list") ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const admin = createAdminClient();

    // Clear existing custom pool for this sport
    await admin
      .from("sweepstakes_pool")
      .delete()
      .eq("sweepstakes_id", sweepstakesId)
      .eq("sport_id", sport);

    if (!lines.length) {
      revalidatePath(`/admin/sweepstakes/${sweepstakesId}/pool`);
      return { ok: true, message: "Reset to the auto-derived pool." };
    }

    // Existing teams for matching
    const { data: existing } = await admin
      .from("teams")
      .select("id,name,abbrev")
      .eq("sport_id", sport);
    const byAbbrev = new Map((existing ?? []).map((t) => [norm(t.abbrev), t.id]));
    const byName = new Map((existing ?? []).map((t) => [norm(t.name), t.id]));

    const teamIds: string[] = [];
    let created = 0;
    for (const line of lines) {
      const n = norm(line);
      let id = byAbbrev.get(n) ?? byName.get(n);
      if (!id) {
        // partial name match
        const hit = (existing ?? []).find(
          (t) => norm(t.name).includes(n) && n.length > 2,
        );
        id = hit?.id;
      }
      if (!id) {
        const { data: made } = await admin
          .from("teams")
          .insert({
            sport_id: sport,
            abbrev: line.slice(0, 12),
            name: line,
            active: true,
          })
          .select("id")
          .single();
        if (made) {
          id = made.id;
          byAbbrev.set(n, id);
          created++;
        }
      }
      if (id && !teamIds.includes(id)) teamIds.push(id);
    }

    if (teamIds.length) {
      await admin.from("sweepstakes_pool").insert(
        teamIds.map((team_id) => ({
          sweepstakes_id: sweepstakesId,
          sport_id: sport,
          team_id,
        })),
      );
    }

    revalidatePath(`/admin/sweepstakes/${sweepstakesId}/pool`);
    return {
      ok: true,
      message: `Custom pool set — ${teamIds.length} entries${created ? ` (${created} new)` : ""}.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}
