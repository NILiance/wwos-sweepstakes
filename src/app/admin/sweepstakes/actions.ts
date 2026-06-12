"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const STATUSES = [
  "draft",
  "enrolling",
  "full",
  "drawing",
  "active",
  "completed",
  "archived",
] as const;

export async function setStatus(formData: FormData): Promise<void> {
  const { userId: adminId } = await requireStaff("sweepstakes");
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return;

  const admin = createAdminClient();
  await admin.from("sweepstakes").update({ status }).eq("id", id);
  await admin.from("audit_log").insert({
    actor: adminId,
    action: "sweepstakes.status",
    target: id,
    detail: { status },
  });
  revalidatePath("/admin/sweepstakes");
  revalidatePath("/browse");
}

export async function addAmoeEntry(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const { userId: adminId } = await requireStaff("sweepstakes");
    const sweepstakesId = String(formData.get("sweepstakes_id"));
    const email = String(formData.get("email")).trim().toLowerCase();
    const displayName = String(formData.get("display_name")).trim();
    if (!email || !displayName) {
      return { ok: false, message: "Email and display name are required." };
    }

    const admin = createAdminClient();

    // Capacity check
    const [{ data: sw }, { count: taken }] = await Promise.all([
      admin
        .from("sweepstakes")
        .select("pool_size,status")
        .eq("id", sweepstakesId)
        .single(),
      admin
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("sweepstakes_id", sweepstakesId)
        .eq("status", "active"),
    ]);
    if (!sw) return { ok: false, message: "Sweepstakes not found." };
    if ((taken ?? 0) >= sw.pool_size) {
      return { ok: false, message: "Pool is full." };
    }

    // Find or create the user (AMOE entrants may not have accounts yet)
    let userId: string;
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
    if (created?.user) {
      userId = created.user.id;
    } else if (createErr?.message.toLowerCase().includes("already")) {
      const { data: list } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const existing = list?.users.find((u) => u.email === email);
      if (!existing) return { ok: false, message: "User lookup failed." };
      userId = existing.id;
    } else {
      return { ok: false, message: createErr?.message ?? "User create failed." };
    }

    const { error: entryErr } = await admin.from("entries").insert({
      sweepstakes_id: sweepstakesId,
      owner_user_id: userId,
      display_name: displayName,
      status: "active",
      source: "amoe",
    });
    if (entryErr) return { ok: false, message: entryErr.message };

    // Flip to full if last spot taken
    if ((taken ?? 0) + 1 >= sw.pool_size && sw.status === "enrolling") {
      await admin
        .from("sweepstakes")
        .update({ status: "full" })
        .eq("id", sweepstakesId);
    }

    await admin.from("audit_log").insert({
      actor: adminId,
      action: "entry.amoe_create",
      target: sweepstakesId,
      detail: { email, display_name: displayName },
    });

    revalidatePath("/admin/sweepstakes");
    return { ok: true, message: `AMOE entry created for ${displayName}.` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed.",
    };
  }
}
