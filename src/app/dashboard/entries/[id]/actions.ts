"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, p, cta, SITE } from "@/lib/email";

export async function inviteCoOwner(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const entryId = String(formData.get("entry_id"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email." };
  }

  const admin = createAdminClient();
  const { data: entry } = await admin
    .from("entries")
    .select("id,owner_user_id,display_name,sweepstakes(name,slug)")
    .eq("id", entryId)
    .single();
  if (!entry || entry.owner_user_id !== user.id) {
    return { ok: false, message: "Only the entry owner can invite." };
  }

  const { data: dupe } = await admin
    .from("entry_shares")
    .select("id")
    .eq("entry_id", entryId)
    .eq("invited_email", email)
    .maybeSingle();
  if (dupe) return { ok: false, message: "Already invited." };

  // Link immediately if they have an account; else hold by email until signup
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);

  const { error } = await admin.from("entry_shares").insert({
    entry_id: entryId,
    user_id: existing?.id ?? null,
    invited_email: email,
    status: existing ? "accepted" : "invited",
  });
  if (error) return { ok: false, message: error.message };

  const sw = entry.sweepstakes as unknown as { name: string; slug: string };
  await sendEmail(
    email,
    `You've been added to ${entry.display_name} in ${sw.name}`,
    "You're on the team 🤝",
    p(`<strong>${entry.display_name}</strong> in <strong>${sw.name}</strong> is now shared with you.`) +
      p(existing ? "It already shows on your dashboard." : "Create an account with this email and the entry appears on your dashboard automatically.") +
      cta(existing ? `${SITE}/dashboard` : `${SITE}/login`, existing ? "View your entries" : "Create account"),
  );

  revalidatePath(`/dashboard/entries/${entryId}`);
  return { ok: true, message: `Invited ${email}.` };
}

export async function reportScoreIssue(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const entryId = String(formData.get("entry_id"));
  const reason = String(formData.get("reason"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (!["wrong_winner", "missing_game", "wrong_points", "duplicate", "other"].includes(reason)) {
    return { ok: false, message: "Pick a reason." };
  }

  // rate limit: 3 open disputes per user
  const admin = createAdminClient();
  const { count } = await admin
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["open", "under_review"]);
  if ((count ?? 0) >= 3) {
    return { ok: false, message: "You have 3 open reports already — we're on it." };
  }

  const { error } = await admin.from("disputes").insert({
    user_id: user.id,
    entry_id: entryId,
    reason,
    note: note || null,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Reported — we'll review and email you the outcome." };
}

export async function removeCoOwner(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const shareId = String(formData.get("share_id"));
  const admin = createAdminClient();
  const { data: share } = await admin
    .from("entry_shares")
    .select("id,entry_id,entries(owner_user_id)")
    .eq("id", shareId)
    .single();
  if (
    !share ||
    (share.entries as unknown as { owner_user_id: string })?.owner_user_id !==
      user.id
  )
    return;
  await admin.from("entry_shares").delete().eq("id", shareId);
  revalidatePath(`/dashboard/entries/${share.entry_id}`);
}
