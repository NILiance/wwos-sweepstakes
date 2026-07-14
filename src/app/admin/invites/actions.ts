"use server";

import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateUserId, sendMagicInvite } from "@/lib/invite";
import { p } from "@/lib/email";

/**
 * Invite a standard player account. Grantable to mid-tier admins via the
 * "invites" section — it can only create role "user" and never touches roles,
 * permissions, or existing accounts' access.
 */
export async function inviteUser(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const ctx = await requireStaff("invites");
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const displayName = String(formData.get("display_name") ?? "").trim();
    if (!email || !displayName)
      return { ok: false, message: "Email and name are both required." };

    const userId = await getOrCreateUserId(email, displayName);
    if (!userId)
      return { ok: false, message: "Couldn't create or find that account." };

    const sent = await sendMagicInvite(email, {
      subject: "You're invited to WWOS Sweepstakes",
      title: "Welcome 🎉",
      introHtml: p(
        `Hi ${displayName}, you've been invited to WWOS Sweepstakes. Click below to sign in and jump into the pools.`,
      ),
      ctaLabel: "Sign in & browse pools",
      next: "/browse",
    });

    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      actor: ctx.userId,
      action: "user.invite",
      target: userId,
      detail: { email },
    });

    return {
      ok: sent,
      message: sent
        ? `Invite sent to ${email}.`
        : "Account is ready, but the invite email couldn't be sent.",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}
