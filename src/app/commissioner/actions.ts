"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCommissioner, requireLeagueAccess } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseConfig } from "@/lib/sweepstakes-config";

export async function createCommissionerLeague(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  let newId: string | null = null;
  try {
    const { userId, active } = await requireCommissioner();
    if (!active)
      return { ok: false, message: "Your commissioner access isn't active." };
    const cfg = parseConfig(formData);
    const admin = createAdminClient();

    const { data: sw, error } = await admin
      .from("sweepstakes")
      .insert({
        name: cfg.name,
        slug: cfg.slug,
        description: cfg.description,
        season_label: cfg.season_label,
        // commissioners run their own money off-platform; visibility is their call
        visibility: cfg.visibility,
        game_mode:
          formData.get("game_mode") === "bracket" ? "bracket" : "draw_roster",
        status: "draft",
        pool_size: cfg.pool_size,
        entry_price_cents: cfg.entry_price_cents,
        payout_structure: cfg.payout_structure,
        side_pots: cfg.side_pots,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) return { ok: false, message: error.message };
    newId = sw.id;

    await admin
      .from("sweepstakes_sports")
      .insert(cfg.sports.map((s) => ({ ...s, sweepstakes_id: sw.id })));

    await admin.from("audit_log").insert({
      actor: userId,
      action: "league.create",
      target: sw.id,
      detail: { name: cfg.name },
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
  if (newId) {
    revalidatePath("/commissioner");
    redirect(`/commissioner/leagues/${newId}`);
  }
  return { ok: true, message: "Created." };
}

/** Add an entrant by name (commissioner leagues collect money off-platform). */
export async function addLeagueEntrant(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const sweepstakesId = String(formData.get("sweepstakes_id"));
    const userId = await requireLeagueAccess(sweepstakesId);
    const displayName = String(formData.get("display_name") ?? "").trim();
    if (!displayName) return { ok: false, message: "Member name required." };
    const email = String(formData.get("email") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;

    const admin = createAdminClient();
    const [{ data: sw }, { count: taken }] = await Promise.all([
      admin.from("sweepstakes").select("pool_size,status").eq("id", sweepstakesId).single(),
      admin
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("sweepstakes_id", sweepstakesId)
        .eq("status", "active"),
    ]);
    if (!sw) return { ok: false, message: "League not found." };
    if ((taken ?? 0) >= sw.pool_size)
      return { ok: false, message: "League is full." };

    // Members are owned by the commissioner for management purposes
    const { error } = await admin.from("entries").insert({
      sweepstakes_id: sweepstakesId,
      owner_user_id: userId,
      display_name: displayName,
      email,
      phone,
      status: "active",
      source: "admin",
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/commissioner/leagues/${sweepstakesId}`);
    return { ok: true, message: `Added ${displayName}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

/** Record an off-platform entry payment receipt. */
export async function recordPayment(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const sweepstakesId = String(formData.get("sweepstakes_id"));
    const userId = await requireLeagueAccess(sweepstakesId);
    const payerName = String(formData.get("payer_name") ?? "").trim();
    const amount = Math.round(Number(formData.get("amount") ?? 0) * 100);
    const method = String(formData.get("method") ?? "").trim() || null;
    const note = String(formData.get("note") ?? "").trim() || null;
    const status = String(formData.get("status") ?? "received");
    const entryId = String(formData.get("entry_id") ?? "") || null;
    if (!payerName) return { ok: false, message: "Who paid?" };

    const admin = createAdminClient();
    const { error } = await admin.from("league_payments").insert({
      sweepstakes_id: sweepstakesId,
      entry_id: entryId,
      payer_name: payerName,
      amount_cents: amount,
      method,
      note,
      status: ["received", "pending", "refunded"].includes(status)
        ? status
        : "received",
      recorded_by: userId,
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/commissioner/leagues/${sweepstakesId}`);
    return { ok: true, message: "Payment recorded." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deletePayment(formData: FormData): Promise<void> {
  const sweepstakesId = String(formData.get("sweepstakes_id"));
  await requireLeagueAccess(sweepstakesId);
  const id = String(formData.get("payment_id"));
  const admin = createAdminClient();
  await admin.from("league_payments").delete().eq("id", id);
  revalidatePath(`/commissioner/leagues/${sweepstakesId}`);
}

/** Edit a member's name / contact details. */
export async function updateLeagueMember(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const sweepstakesId = String(formData.get("sweepstakes_id"));
    await requireLeagueAccess(sweepstakesId);
    const entryId = String(formData.get("entry_id"));
    const displayName = String(formData.get("display_name") ?? "").trim();
    if (!displayName) return { ok: false, message: "Member name required." };

    const admin = createAdminClient();
    const { error } = await admin
      .from("entries")
      .update({
        display_name: displayName,
        email: String(formData.get("email") ?? "").trim() || null,
        phone: String(formData.get("phone") ?? "").trim() || null,
      })
      .eq("id", entryId)
      .eq("sweepstakes_id", sweepstakesId);
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/commissioner/leagues/${sweepstakesId}`);
    return { ok: true, message: "Saved." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

/** Remove a member from the league. */
export async function removeLeagueMember(formData: FormData): Promise<void> {
  const sweepstakesId = String(formData.get("sweepstakes_id"));
  await requireLeagueAccess(sweepstakesId);
  const entryId = String(formData.get("entry_id"));
  const admin = createAdminClient();
  await admin
    .from("entries")
    .delete()
    .eq("id", entryId)
    .eq("sweepstakes_id", sweepstakesId);
  revalidatePath(`/commissioner/leagues/${sweepstakesId}`);
}

/** Email all members who have an address, and log the message. */
export async function messageMembers(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const sweepstakesId = String(formData.get("sweepstakes_id"));
    const userId = await requireLeagueAccess(sweepstakesId);
    const subject = String(formData.get("subject") ?? "").trim();
    const bodyText = String(formData.get("body") ?? "").trim();
    if (!subject || !bodyText)
      return { ok: false, message: "Subject and message are both required." };

    const admin = createAdminClient();
    const { data: sw } = await admin
      .from("sweepstakes")
      .select("name")
      .eq("id", sweepstakesId)
      .single();
    const { data: members } = await admin
      .from("entries")
      .select("display_name,email")
      .eq("sweepstakes_id", sweepstakesId)
      .eq("status", "active")
      .not("email", "is", null);

    const recipients = (members ?? []).filter((m) => m.email);
    if (recipients.length === 0)
      return {
        ok: false,
        message: "No members have an email address yet. Add one first.",
      };

    const { sendEmail, p } = await import("@/lib/email");
    const html =
      p(`<strong>${sw?.name ?? "Your league"}</strong>`) +
      bodyText
        .split(/\n{2,}/)
        .map((para) => p(para.replace(/\n/g, "<br/>")))
        .join("");

    let sent = 0;
    for (const m of recipients) {
      const ok = await sendEmail(m.email as string, subject, subject, html, {
        force: true,
      });
      if (ok) sent++;
    }

    await admin.from("league_messages").insert({
      sweepstakes_id: sweepstakesId,
      subject,
      body: bodyText,
      recipient_count: sent,
      sent_by: userId,
    });
    revalidatePath(`/commissioner/leagues/${sweepstakesId}`);
    return { ok: true, message: `Sent to ${sent} member${sent === 1 ? "" : "s"}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

/**
 * Schedule (or clear) the auto-run time for a league's draw, and set the
 * league's display timezone. Times are entered as wall-clock in the chosen
 * timezone and stored as UTC.
 */
export async function scheduleDraw(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const sweepstakesId = String(formData.get("sweepstakes_id"));
    await requireLeagueAccess(sweepstakesId);
    const { localToUtc, PLATFORM_TZ, TIMEZONES } = await import("@/lib/tz");
    const tzInput = String(formData.get("timezone") ?? "").trim();
    const tz = TIMEZONES.includes(tzInput) ? tzInput : PLATFORM_TZ;
    const local = String(formData.get("draw_at") ?? "").trim();
    const drawAtUtc = local ? localToUtc(local, tz) : null;

    const admin = createAdminClient();
    const { error } = await admin
      .from("sweepstakes")
      .update({
        timezone: tz,
        draw_at: drawAtUtc,
        // clear the fired-marker so a rescheduled draw can run again
        draw_scheduled_run_at: null,
      })
      .eq("id", sweepstakesId);
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/commissioner/leagues/${sweepstakesId}/draw`);
    return {
      ok: true,
      message: drawAtUtc ? "Draw scheduled." : "Schedule cleared.",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}
