"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { scorePass } from "@/lib/ingest";

/**
 * Manual game correction (central repository — affects every pool).
 * Existing point events for the game are removed and re-awarded by the
 * scoring pass so points always match the corrected result.
 */
export async function fixGame(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const ctx = await requireStaff("dataops");
    const gameId = String(formData.get("game_id"));
    const winner = String(formData.get("winner")); // team id | 'none'
    const eventType = String(formData.get("event_type")).trim() || "regular";
    const status = String(formData.get("status"));
    const homeScore = formData.get("home_score");
    const awayScore = formData.get("away_score");

    const admin = createAdminClient();
    const { data: game } = await admin
      .from("games")
      .select("id,meta")
      .eq("id", gameId)
      .single();
    if (!game) return { ok: false, message: "Game not found." };

    const meta = (game.meta ?? {}) as Record<string, unknown>;
    if (homeScore !== null && homeScore !== "")
      meta.home_score = Number(homeScore);
    if (awayScore !== null && awayScore !== "")
      meta.away_score = Number(awayScore);

    const { error } = await admin
      .from("games")
      .update({
        winner_team_id: winner === "none" ? null : winner,
        event_type: eventType,
        status: ["scheduled", "final", "postponed", "canceled"].includes(status)
          ? status
          : "final",
        result_source: "manual",
        meta,
      })
      .eq("id", gameId);
    if (error) return { ok: false, message: error.message };

    // Re-derive points for this game across every pool
    const { count } = await admin
      .from("point_events")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId);
    await admin.from("point_events").delete().eq("game_id", gameId);
    const rescored = await scorePass();

    await admin.from("audit_log").insert({
      actor: ctx.userId,
      action: "game.manual_fix",
      target: gameId,
      detail: { winner, eventType, status, removed_events: count ?? 0 },
    });

    revalidatePath("/admin/dataops");
    return {
      ok: true,
      message: `Saved — ${count ?? 0} stale point event(s) removed, ${rescored.events} re-awarded.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

export async function addManualGame(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const ctx = await requireStaff("dataops");
    const sport = String(formData.get("sport"));
    const winnerAbbrev = String(formData.get("winner_abbrev")).trim();
    const eventType = String(formData.get("event_type")).trim() || "regular";
    const date = String(formData.get("date"));

    const admin = createAdminClient();
    const { data: winner } = await admin
      .from("teams")
      .select("id,name")
      .eq("sport_id", sport)
      .ilike("abbrev", winnerAbbrev)
      .maybeSingle();
    if (!winner)
      return { ok: false, message: `No ${sport} team/golfer "${winnerAbbrev}".` };

    const { error } = await admin.from("games").insert({
      sport_id: sport,
      external_ref: `manual-${crypto.randomUUID().slice(0, 12)}`,
      starts_at: date ? new Date(date).toISOString() : new Date().toISOString(),
      status: "final",
      winner_team_id: winner.id,
      event_type: eventType,
      result_source: "manual",
      meta: { manual: true },
    });
    if (error) return { ok: false, message: error.message };

    const rescored = await scorePass();
    await admin.from("audit_log").insert({
      actor: ctx.userId,
      action: "game.manual_add",
      target: sport,
      detail: { winner: winner.name, eventType },
    });
    revalidatePath("/admin/dataops");
    return {
      ok: true,
      message: `Result recorded for ${winner.name} — ${rescored.events} point event(s) awarded.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}
