"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { LEAGUES, type League } from "@/lib/sportsdata";
import { runIngest } from "@/lib/ingest";

export async function syncNow(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireStaff("dataops");
    const league = String(formData.get("league") ?? "all");
    const leagues =
      league === "all" || league === "golf"
        ? league === "golf"
          ? []
          : LEAGUES
        : LEAGUES.filter((l) => l === (league as League));
    const results = await runIngest(leagues, league === "all" || league === "golf");
    revalidatePath("/admin/dataops");
    const parts = Object.entries(results)
      .filter(([k]) => k !== "scoring")
      .map(([k, v]) => {
        const r = v as { games?: { games: number }; error?: string };
        return r.error ? `${k}: ERROR` : `${k}: ${r.games?.games ?? 0} games`;
      });
    const scoring = results.scoring as { events: number };
    return {
      ok: true,
      message: `${parts.join(" · ")} · ${scoring.events} new point events`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Sync failed." };
  }
}
