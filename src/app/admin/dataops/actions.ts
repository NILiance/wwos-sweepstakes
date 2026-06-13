"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAGUES, type League } from "@/lib/sportsdata";
import { runIngest } from "@/lib/ingest";
import { sendEmail, p } from "@/lib/email";

export async function resolveDispute(formData: FormData): Promise<void> {
  const ctx = await requireStaff("dataops");
  const id = String(formData.get("dispute_id"));
  const status = String(formData.get("status"));
  const note = String(formData.get("resolution_note") ?? "").trim();
  if (!["fixed_central", "adjusted_pool", "rejected"].includes(status)) return;

  const admin = createAdminClient();
  const { data: dispute } = await admin
    .from("disputes")
    .select("id,user_id,reason")
    .eq("id", id)
    .single();
  if (!dispute) return;

  await admin
    .from("disputes")
    .update({
      status,
      resolution_note: note || null,
      resolved_by: ctx.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);

  const { data: u } = await admin.auth.admin.getUserById(dispute.user_id);
  if (u?.user?.email) {
    await sendEmail(
      u.user.email,
      "Your score report has been reviewed",
      status === "rejected" ? "Score confirmed" : "Score corrected ✓",
      p(
        status === "rejected"
          ? "We reviewed your report and confirmed the score as recorded."
          : "We reviewed your report and corrected the scoring.",
      ) + (note ? p(`Reviewer note: ${note}`) : ""),
    );
  }
  revalidatePath("/admin/dataops");
}

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
