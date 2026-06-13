"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { poolStandings } from "@/lib/standings";

export async function generatePayouts(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const adminId = await requireAdmin();
    const sweepstakesId = String(formData.get("sweepstakes_id"));
    const admin = createAdminClient();

    const { data: sw } = await admin
      .from("sweepstakes")
      .select("id,name,payout_structure")
      .eq("id", sweepstakesId)
      .single();
    if (!sw) return { ok: false, message: "Pool not found." };

    const { data: existing } = await admin
      .from("payouts")
      .select("id")
      .eq("sweepstakes_id", sweepstakesId)
      .limit(1);
    if (existing?.length)
      return { ok: false, message: "Payouts already generated for this pool." };

    const structure = (sw.payout_structure ?? []) as {
      place: number;
      amount_cents: number;
    }[];
    if (!structure.length)
      return { ok: false, message: "No payout structure configured." };

    const ranked = await poolStandings(sweepstakesId);
    const rows = structure
      .filter((p) => ranked[p.place - 1])
      .map((p) => ({
        sweepstakes_id: sweepstakesId,
        pot_type: "place",
        place: p.place,
        entry_id: ranked[p.place - 1].id,
        amount_cents: p.amount_cents,
        status: "pending",
        tax_doc_status: p.amount_cents >= 60000 ? "requested" : "not_required",
      }));
    const { error } = await admin.from("payouts").insert(rows);
    if (error) return { ok: false, message: error.message };

    await admin.from("audit_log").insert({
      actor: adminId,
      action: "payouts.generate",
      target: sweepstakesId,
      detail: { count: rows.length },
    });
    revalidatePath("/admin/payouts");
    return { ok: true, message: `${rows.length} payouts created from final standings.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

const FLOW: Record<string, string> = {
  pending: "approved",
  approved: "sent",
};

export async function advancePayout(formData: FormData): Promise<void> {
  const adminId = await requireAdmin();
  const id = String(formData.get("payout_id"));
  const admin = createAdminClient();
  const { data: payout } = await admin
    .from("payouts")
    .select("id,status,sweepstakes_id,amount_cents")
    .eq("id", id)
    .single();
  if (!payout) return;
  const next = FLOW[payout.status];
  if (!next) return;

  await admin.from("payouts").update({ status: next }).eq("id", id);
  if (next === "sent") {
    await admin.from("pot_ledger").insert({
      sweepstakes_id: payout.sweepstakes_id,
      type: "payout",
      amount_cents: -payout.amount_cents,
      ref_payout_id: payout.id,
    });
  }
  await admin.from("audit_log").insert({
    actor: adminId,
    action: `payout.${next}`,
    target: id,
  });
  revalidatePath("/admin/payouts");
}

export async function toggleW9(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("payout_id"));
  const to = String(formData.get("to"));
  if (!["requested", "received", "not_required"].includes(to)) return;
  const admin = createAdminClient();
  await admin.from("payouts").update({ tax_doc_status: to }).eq("id", id);
  revalidatePath("/admin/payouts");
}
