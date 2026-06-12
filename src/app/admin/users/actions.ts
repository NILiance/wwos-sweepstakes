"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const SECTIONS = [
  "overview",
  "sweepstakes",
  "products",
  "branding",
  "simulator",
  "users",
];

export async function addUser(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const adminId = await requireAdmin();
    const email = String(formData.get("email")).trim().toLowerCase();
    const displayName = String(formData.get("display_name")).trim();
    const role = String(formData.get("role"));
    if (!email || !displayName)
      return { ok: false, message: "Email and name required." };
    if (!["user", "staff", "admin"].includes(role))
      return { ok: false, message: "Invalid role." };

    const admin = createAdminClient();
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error) return { ok: false, message: error.message };

    const permissions = SECTIONS.filter((s) => formData.get(`perm_${s}`));
    await admin
      .from("profiles")
      .update({
        role,
        permissions: role === "staff" ? permissions : [],
        is_admin: role === "admin",
      })
      .eq("id", created.user.id);

    await admin.from("audit_log").insert({
      actor: adminId,
      action: "user.create",
      target: created.user.id,
      detail: { email, role, permissions },
    });

    revalidatePath("/admin/users");
    return {
      ok: true,
      message: `${displayName} added as ${role}. They can sign in via "Email me a sign-in link".`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

export async function updateUserRole(formData: FormData): Promise<void> {
  const adminId = await requireAdmin();
  const userId = String(formData.get("user_id"));
  const role = String(formData.get("role"));
  if (!["user", "staff", "admin"].includes(role)) return;
  if (userId === adminId && role !== "admin") return; // can't demote yourself

  const permissions = SECTIONS.filter((s) => formData.get(`perm_${s}`));
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({
      role,
      permissions: role === "staff" ? permissions : [],
      is_admin: role === "admin",
    })
    .eq("id", userId);

  await admin.from("audit_log").insert({
    actor: adminId,
    action: "user.role",
    target: userId,
    detail: { role, permissions },
  });
  revalidatePath("/admin/users");
}
