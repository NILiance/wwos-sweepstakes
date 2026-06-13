"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Save per-sweepstakes scoring overrides. Form fields are named
 * pts__<sport>__<rule_key>__<scope>. Any value differing from the platform
 * default is written as a sweepstakes-scoped scoring_rules row; matching
 * defaults are removed so the pool falls back cleanly.
 */
export async function saveScoringMatrix(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireStaff("sweepstakes");
    const sweepstakesId = String(formData.get("sweepstakes_id"));
    const admin = createAdminClient();

    // Platform defaults to compare against
    const { data: defaults } = await admin
      .from("scoring_rules")
      .select("sport_id,rule_key,label,points,scope")
      .is("sweepstakes_id", null);
    const defByKey = new Map(
      (defaults ?? []).map((d) => [`${d.sport_id}|${d.rule_key}|${d.scope}`, d]),
    );

    const overrides: {
      sweepstakes_id: string;
      sport_id: string;
      rule_key: string;
      label: string;
      points: number;
      scope: string;
    }[] = [];

    for (const [name, raw] of formData.entries()) {
      if (!name.startsWith("pts__")) continue;
      const [, sport, ruleKey, scope] = name.split("__");
      const points = Math.round(Number(raw));
      if (!Number.isFinite(points)) continue;
      const def = defByKey.get(`${sport}|${ruleKey}|${scope}`);
      // half rules have no platform default — always store if > 0
      const isHalf = scope === "half1" || scope === "half2";
      if (def && points === def.points) continue; // unchanged default
      if (isHalf && points === 0) continue; // off
      const label =
        def?.label ??
        (scope === "half1"
          ? "1st half win"
          : scope === "half2"
            ? "2nd half win"
            : ruleKey);
      overrides.push({
        sweepstakes_id: sweepstakesId,
        sport_id: sport,
        rule_key: ruleKey,
        label,
        points,
        scope,
      });
    }

    // Replace this pool's overrides atomically
    await admin
      .from("scoring_rules")
      .delete()
      .eq("sweepstakes_id", sweepstakesId);
    if (overrides.length) {
      const { error } = await admin.from("scoring_rules").insert(overrides);
      if (error) return { ok: false, message: error.message };
    }

    revalidatePath(`/admin/sweepstakes/${sweepstakesId}/scoring`);
    revalidatePath(`/s`, "layout");
    return {
      ok: true,
      message: overrides.length
        ? `Saved — ${overrides.length} custom value(s). Others use platform defaults.`
        : "Saved — all values reset to platform defaults.",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}
