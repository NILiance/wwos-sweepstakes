"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { setSetting } from "@/lib/settings";

export async function saveSponsor(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireStaff("settings");
    const val = (k: string) => String(formData.get(k) ?? "").trim();
    await setSetting("sponsor", {
      name: val("name"),
      address1: val("address1"),
      address2: val("address2"),
      city: val("city"),
      state: val("state"),
      zip: val("zip"),
      amoeNote: val("amoeNote"),
    });
    // Official rules pages render the address
    revalidatePath("/s", "layout");
    return { ok: true, message: "Sponsor address saved — live on official rules." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

export async function saveCommissionerPlan(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireStaff("settings");
    const fee = Math.round(Number(formData.get("yearly_fee") ?? 0) * 100);
    const enabled = !!formData.get("enabled");
    await setSetting("commissioner_plan", {
      yearly_fee_cents: fee,
      enabled,
    });
    revalidatePath("/commissioner", "layout");
    return {
      ok: true,
      message: enabled
        ? `Commissioner plan ${fee > 0 ? `at $${(fee / 100).toLocaleString()}/yr` : "(free)"} — enabled.`
        : "Commissioner plan saved (disabled).",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}
