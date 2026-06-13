import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, p, cta, SITE } from "@/lib/email";

/** Grant/extend commissioner access for a year. Idempotent per Stripe session. */
export async function activateCommissioner(
  userId: string,
  opts: { amountCents?: number; stripeSession?: string } = {},
): Promise<{ ok: boolean; alreadyActive?: boolean }> {
  const admin = createAdminClient();

  // Idempotency: a given paid session activates once
  if (opts.stripeSession) {
    const { data: existing } = await admin
      .from("commissioner_subscriptions")
      .select("id")
      .eq("stripe_session_id", opts.stripeSession)
      .maybeSingle();
    if (existing) return { ok: true, alreadyActive: true };
  }

  const { data: current } = await admin
    .from("commissioner_subscriptions")
    .select("paid_through")
    .eq("user_id", userId)
    .maybeSingle();

  // Extend from the later of now or current paid_through
  const base =
    current?.paid_through && new Date(current.paid_through) > new Date()
      ? new Date(current.paid_through)
      : new Date();
  const paidThrough = new Date(base);
  paidThrough.setFullYear(paidThrough.getFullYear() + 1);

  await admin.from("commissioner_subscriptions").upsert(
    {
      user_id: userId,
      status: "active",
      paid_through: paidThrough.toISOString(),
      amount_cents: opts.amountCents ?? 0,
      stripe_session_id: opts.stripeSession ?? null,
      renewal_notified_at: null,
    },
    { onConflict: "user_id" },
  );

  // Promote role (don't demote an admin)
  const { data: profile } = await admin
    .from("profiles")
    .select("role,is_admin")
    .eq("id", userId)
    .single();
  if (profile?.role !== "admin" && !profile?.is_admin) {
    await admin.from("profiles").update({ role: "commissioner" }).eq("id", userId);
  }

  const { data: u } = await admin.auth.admin.getUserById(userId);
  if (u?.user?.email) {
    await sendEmail(
      u.user.email,
      "You're a WWOS commissioner",
      "Your league HQ is open 🏆",
      p(
        `Your commissioner access is active through <strong>${paidThrough.toLocaleDateString(
          "en-US",
          { month: "long", day: "numeric", year: "numeric" },
        )}</strong>.`,
      ) +
        p("Create and run your own leagues — set up the field, draw live, and track standings all season.") +
        cta(`${SITE}/commissioner`, "Open commissioner HQ"),
      { force: true },
    );
  }

  return { ok: true };
}

/**
 * Email commissioners whose access expires within `withinDays`, once per
 * renewal cycle, and flag lapsed subscriptions as past_due. Idempotent: only
 * notifies when renewal_notified_at predates the current paid_through window.
 */
export async function sendRenewalNotices(
  withinDays = 14,
): Promise<{ notified: number; lapsed: number }> {
  const admin = createAdminClient();
  const now = new Date();
  const soon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const { data: subs } = await admin
    .from("commissioner_subscriptions")
    .select("id,user_id,status,paid_through,renewal_notified_at")
    .lte("paid_through", soon.toISOString());

  let notified = 0;
  let lapsed = 0;

  for (const s of subs ?? []) {
    const paidThrough = s.paid_through ? new Date(s.paid_through) : null;
    if (!paidThrough) continue;

    const expired = paidThrough <= now;
    if (expired && s.status !== "past_due") {
      await admin
        .from("commissioner_subscriptions")
        .update({ status: "past_due" })
        .eq("id", s.id);
      lapsed++;
    }

    // Notify once per cycle: skip if already notified after the window opened.
    const windowOpen = new Date(
      paidThrough.getTime() - withinDays * 24 * 60 * 60 * 1000,
    );
    const alreadyNotified =
      s.renewal_notified_at && new Date(s.renewal_notified_at) >= windowOpen;
    if (alreadyNotified) continue;

    const { data: u } = await admin.auth.admin.getUserById(s.user_id);
    if (u?.user?.email) {
      const when = paidThrough.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      await sendEmail(
        u.user.email,
        expired
          ? "Your WWOS commissioner access has lapsed"
          : "Your WWOS commissioner access renews soon",
        expired ? "Renew to keep your leagues running" : "Renewal coming up 🗓️",
        p(
          expired
            ? `Your commissioner access expired on <strong>${when}</strong>. Renew to keep creating and running leagues.`
            : `Your commissioner access is paid through <strong>${when}</strong>. Renew now so your leagues never pause.`,
        ) + cta(`${SITE}/commissioner/join`, "Renew commissioner access"),
        { force: true },
      );
      notified++;
    }

    await admin
      .from("commissioner_subscriptions")
      .update({ renewal_notified_at: now.toISOString() })
      .eq("id", s.id);
  }

  return { notified, lapsed };
}
