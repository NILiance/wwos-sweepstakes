import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, p, cta, SITE } from "@/lib/email";

/**
 * Idempotent fulfillment: paid checkout session → order + entry + pot ledger.
 * Called from both the success page (dev/fast path) and the Stripe webhook
 * (production source of truth). Safe to call twice for the same session.
 */
export async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  const admin = createAdminClient();

  if (session.payment_status !== "paid") {
    return { ok: false as const, reason: "not_paid" };
  }
  const meta = session.metadata ?? {};
  const { sweepstakes_id, product_id, user_id } = meta;
  if (!sweepstakes_id || !product_id || !user_id) {
    return { ok: false as const, reason: "missing_metadata" };
  }

  // Idempotency: one order per stripe session
  const { data: existingOrder } = await admin
    .from("orders")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existingOrder) {
    const { data: entry } = await admin
      .from("entries")
      .select("id")
      .eq("order_id", existingOrder.id)
      .maybeSingle();
    return { ok: true as const, orderId: existingOrder.id, entryId: entry?.id };
  }

  const shipping = session.collected_information?.shipping_details ?? null;

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      user_id,
      product_id,
      stripe_session_id: session.id,
      status: "paid",
      amount_cents: session.amount_total ?? 0,
      shipping,
    })
    .select("id")
    .single();
  if (orderErr) return { ok: false as const, reason: orderErr.message };

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user_id)
    .single();

  const { data: entry, error: entryErr } = await admin
    .from("entries")
    .insert({
      sweepstakes_id,
      owner_user_id: user_id,
      order_id: order.id,
      display_name: profile?.display_name ?? "Entrant",
      status: "active",
    })
    .select("id")
    .single();
  if (entryErr) return { ok: false as const, reason: entryErr.message };

  await admin.from("pot_ledger").insert({
    sweepstakes_id,
    type: "entry",
    amount_cents: session.amount_total ?? 0,
    ref_order_id: order.id,
  });

  // Flip pool to full when the last spot is taken
  const [{ data: sw }, { count: taken }] = await Promise.all([
    admin.from("sweepstakes").select("pool_size,status").eq("id", sweepstakes_id).single(),
    admin
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("sweepstakes_id", sweepstakes_id)
      .eq("status", "active"),
  ]);
  if (sw?.status === "enrolling" && (taken ?? 0) >= sw.pool_size) {
    await admin
      .from("sweepstakes")
      .update({ status: "full" })
      .eq("id", sweepstakes_id);
  }

  // Receipt + entry confirmation (best-effort)
  const [{ data: swInfo }, { data: prodInfo }, userRes] = await Promise.all([
    admin.from("sweepstakes").select("name,slug").eq("id", sweepstakes_id).single(),
    admin.from("products").select("name").eq("id", product_id).single(),
    admin.auth.admin.getUserById(user_id),
  ]);
  const email = userRes.data?.user?.email;
  if (email && swInfo) {
    await sendEmail(
      email,
      `Order confirmed — ${prodInfo?.name ?? "your purchase"}`,
      "You're in! 🎉",
      p(`Thanks for your purchase of <strong>${prodInfo?.name ?? "the product"}</strong> ($${((session.amount_total ?? 0) / 100).toLocaleString()}).`) +
        p(`Your bonus entry in <strong>${swInfo.name}</strong> is locked in. When the pool fills, the live drawing assigns your roster — watch every pick land in real time.`) +
        cta(`${SITE}/s/${swInfo.slug}`, "View the pool") +
        p(`No purchase was necessary to enter — see the official rules on the pool page.`),
    );
  }

  return { ok: true as const, orderId: order.id, entryId: entry.id };
}
