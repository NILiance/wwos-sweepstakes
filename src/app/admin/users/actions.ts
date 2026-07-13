"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, ADMIN_SECTIONS } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, p, cta, SITE } from "@/lib/email";

// Only non-superadmin areas are grantable to a mid-tier admin (role "staff").
const SECTIONS = ADMIN_SECTIONS as unknown as string[];

const ROLE_LABEL: Record<string, string> = {
  user: "User",
  staff: "Admin",
  admin: "Superadmin",
};

async function sendInviteEmail(email: string, displayName: string) {
  const admin = createAdminClient();
  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const token = link?.properties?.hashed_token;
  const url = token
    ? `${SITE}/auth/confirm?token_hash=${token}&type=magiclink&next=/dashboard`
    : `${SITE}/login`;
  return sendEmail(
    email,
    "You've been added to WWOS Sweepstakes",
    "Welcome aboard 🎉",
    p(`Hi ${displayName}, an account was created for you on WWOS Sweepstakes.`) +
      p("Click below to sign in. You can set a password from your account afterward.") +
      cta(url, "Sign in"),
    { force: true },
  );
}

export async function addUser(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const adminId = await requireAdmin();
    const email = String(formData.get("email")).trim().toLowerCase();
    const displayName = String(formData.get("display_name")).trim();
    const role = String(formData.get("role"));
    const password = String(formData.get("password") ?? "").trim();
    if (!email || !displayName)
      return { ok: false, message: "Email and name required." };
    if (!["user", "staff", "admin"].includes(role))
      return { ok: false, message: "Invalid role." };
    if (password && password.length < 8)
      return { ok: false, message: "Password must be at least 8 characters." };

    const admin = createAdminClient();
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      ...(password ? { password } : {}),
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
      detail: { email, role, withPassword: !!password },
    });

    let note: string;
    if (password) {
      note = "Share their password — they can change it after signing in.";
    } else {
      const sent = await sendInviteEmail(email, displayName);
      note = sent
        ? "An invite email was sent to them."
        : "Couldn't email the invite — set a password or have them use “Email me a sign-in link”.";
    }

    revalidatePath("/admin/users");
    return {
      ok: true,
      message: `${displayName} added as ${ROLE_LABEL[role] ?? role}. ${note}`,
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

export async function setUserPassword(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const adminId = await requireAdmin();
    const userId = String(formData.get("user_id"));
    const password = String(formData.get("password") ?? "").trim();
    if (password.length < 8)
      return { ok: false, message: "Password must be at least 8 characters." };

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
    });
    if (error) return { ok: false, message: error.message };

    await admin.from("audit_log").insert({
      actor: adminId,
      action: "user.set_password",
      target: userId,
    });
    revalidatePath("/admin/users");
    return { ok: true, message: "Password set — share it with the user." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

export async function resendInvite(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireAdmin();
    const email = String(formData.get("email"));
    const displayName = String(formData.get("display_name") ?? "there");
    const sent = await sendInviteEmail(email, displayName);
    return sent
      ? { ok: true, message: "Invite re-sent." }
      : { ok: false, message: "Email couldn't be sent — check SMTP/Resend." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteUser(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const adminId = await requireAdmin();
    const userId = String(formData.get("user_id"));
    if (userId === adminId)
      return { ok: false, message: "You can't delete your own account." };

    const admin = createAdminClient();
    // Block deletion if the user owns entries (preserves pool integrity)
    const { count } = await admin
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", userId);
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        message: `Can't delete — this user owns ${count} entr${count === 1 ? "y" : "ies"}. Refund/withdraw them first.`,
      };
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return { ok: false, message: error.message };

    await admin.from("audit_log").insert({
      actor: adminId,
      action: "user.delete",
      target: userId,
    });
    revalidatePath("/admin/users");
    return { ok: true, message: "User deleted." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}
