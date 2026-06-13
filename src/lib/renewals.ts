import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, p, cta, SITE } from "@/lib/email";

/**
 * Open next season for a series pool: clone config into a new draft,
 * reserve a spot for every active entrant, email them their renewal link.
 */
export async function openNextSeason(opts: {
  priorSweepstakesId: string;
  name: string;
  slug: string;
  seasonLabel: string | null;
  renewalDeadline: string; // ISO date
  actorId: string;
}) {
  const admin = createAdminClient();
  const { data: prior } = await admin
    .from("sweepstakes")
    .select(
      "id,series_id,name,description,visibility,pool_size,entry_price_cents,house_cut_pct,house_cut_flat_cents,payout_structure,side_pots,sweepstakes_sports(sport_id,picks_per_entry,pool_source,top_n)",
    )
    .eq("id", opts.priorSweepstakesId)
    .single();
  if (!prior) throw new Error("Prior pool not found");

  // Ensure a series exists
  let seriesId = prior.series_id;
  if (!seriesId) {
    const { data: series, error } = await admin
      .from("series")
      .insert({ name: prior.name, recurrence_rule: "annual" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    seriesId = series.id;
    await admin
      .from("sweepstakes")
      .update({ series_id: seriesId })
      .eq("id", prior.id);
  }

  const { data: next, error: nextErr } = await admin
    .from("sweepstakes")
    .insert({
      series_id: seriesId,
      name: opts.name,
      slug: opts.slug,
      description: prior.description,
      season_label: opts.seasonLabel,
      visibility: prior.visibility,
      status: "enrolling",
      pool_size: prior.pool_size,
      entry_price_cents: prior.entry_price_cents,
      house_cut_pct: prior.house_cut_pct,
      house_cut_flat_cents: prior.house_cut_flat_cents,
      payout_structure: prior.payout_structure,
      side_pots: prior.side_pots,
      created_by: opts.actorId,
    })
    .select("id,slug,name")
    .single();
  if (nextErr) throw new Error(nextErr.message);

  const sports = (prior.sweepstakes_sports ?? []) as {
    sport_id: string;
    picks_per_entry: number;
    pool_source: string;
    top_n: number | null;
  }[];
  if (sports.length) {
    await admin.from("sweepstakes_sports").insert(
      sports.map((s) => ({ ...s, sweepstakes_id: next.id })),
    );
  }

  // Clone active products (photos + offers come along)
  const { data: products } = await admin
    .from("products")
    .select("name,description,price_cents,inventory,requires_shipping,images,offers")
    .eq("sweepstakes_id", prior.id)
    .eq("active", true);
  if (products?.length) {
    await admin.from("products").insert(
      products.map((pr) => ({ ...pr, sweepstakes_id: next.id, active: true })),
    );
  }

  // Reserve spots + invite
  const { data: entries } = await admin
    .from("entries")
    .select("id,owner_user_id,display_name")
    .eq("sweepstakes_id", prior.id)
    .eq("status", "active");

  let reserved = 0;
  for (const entry of entries ?? []) {
    const { error } = await admin.from("renewals").insert({
      series_id: seriesId,
      prior_entry_id: entry.id,
      user_id: entry.owner_user_id,
      next_sweepstakes_id: next.id,
      status: "reserved",
      deadline: opts.renewalDeadline,
    });
    if (error) continue;
    reserved++;

    const { data: u } = await admin.auth.admin.getUserById(entry.owner_user_id);
    if (u?.user?.email) {
      await sendEmail(
        u.user.email,
        `Your ${next.name} spot is reserved — renew by ${new Date(opts.renewalDeadline).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`,
        "Your spot is waiting 🔒",
        p(`As a returning entrant (<strong>${entry.display_name}</strong>), your spot in <strong>${next.name}</strong> is reserved.`) +
          p(`Purchase by <strong>${new Date(opts.renewalDeadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong> to keep it — after that it opens to the public.`) +
          cta(`${SITE}/s/${next.slug}`, "Renew my spot"),
      );
    }
  }

  return { nextId: next.id, slug: next.slug, reserved };
}

/** Count spots a buyer cannot take: active entries + others' live reservations. */
export async function occupiedSpots(sweepstakesId: string, userId?: string) {
  const admin = createAdminClient();
  const [{ count: taken }, { data: reservations }] = await Promise.all([
    admin
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("sweepstakes_id", sweepstakesId)
      .eq("status", "active"),
    admin
      .from("renewals")
      .select("user_id,deadline")
      .eq("next_sweepstakes_id", sweepstakesId)
      .eq("status", "reserved"),
  ]);
  const now = Date.now();
  const liveReservations = (reservations ?? []).filter(
    (r) =>
      (!r.deadline || new Date(r.deadline).getTime() > now) &&
      r.user_id !== userId,
  ).length;
  return (taken ?? 0) + liveReservations;
}
