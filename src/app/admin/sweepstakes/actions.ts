"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const SPORT_IDS = ["cfb", "nfl", "cbb", "nba", "wnba", "nhl", "pga", "liv", "mlb"];

function parseConfig(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");
  let slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!/^[a-z0-9-]{2,}$/.test(slug)) throw new Error("Slug must be letters/numbers/dashes.");

  const dollars = (key: string) =>
    Math.round(Number(formData.get(key) ?? 0) * 100);

  const payoutCount = Math.min(
    100,
    Math.max(0, Number(formData.get("payout_count") ?? 4)),
  );
  const payout_structure = Array.from({ length: payoutCount }, (_, i) => i + 1)
    .map((p) => {
      const type = formData.get(`payout_type_${p}`) === "percent" ? "percent" : "flat";
      const raw = Number(formData.get(`payout_${p}`) ?? 0);
      return type === "percent"
        ? { place: p, type, percent: raw }
        : { place: p, type, amount_cents: Math.round(raw * 100) };
    })
    .filter((p) =>
      p.type === "percent" ? (p.percent ?? 0) > 0 : (p.amount_cents ?? 0) > 0,
    );

  const side_pots = [
    ["lowest_score", "sidepot_lowest"],
    ["weekly_high", "sidepot_weekly"],
    ["top_team", "sidepot_topteam"],
  ]
    .map(([type, field]) => ({ type, amount_cents: dollars(field) }))
    .filter((p) => p.amount_cents > 0);

  const sports = SPORT_IDS.filter((s) => formData.get(`sport_${s}`)).map(
    (s) => ({
      sport_id: s,
      picks_per_entry: Math.max(1, Number(formData.get(`picks_${s}`) ?? 1)),
      pool_source: "all" as const,
    }),
  );
  if (!sports.length) throw new Error("Pick at least one sport.");

  return {
    name,
    slug,
    description: String(formData.get("description") ?? "").trim() || null,
    season_label: String(formData.get("season_label") ?? "").trim() || null,
    visibility: formData.get("visibility") === "private" ? "private" : "public",
    pool_size: Math.max(2, Number(formData.get("pool_size") ?? 15)),
    entry_price_cents: dollars("entry_price"),
    payout_structure,
    side_pots,
    sports,
  };
}

export async function createSweepstakes(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  let created = false;
  try {
    const { userId } = await requireStaff("sweepstakes");
    const cfg = parseConfig(formData);
    const admin = createAdminClient();

    const { data: sw, error } = await admin
      .from("sweepstakes")
      .insert({
        name: cfg.name,
        slug: cfg.slug,
        description: cfg.description,
        season_label: cfg.season_label,
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
    if (error) throw new Error(error.message);

    await admin.from("sweepstakes_sports").insert(
      cfg.sports.map((s) => ({ ...s, sweepstakes_id: sw.id })),
    );

    const productName = String(formData.get("product_name") ?? "").trim();
    if (productName) {
      await admin.from("products").insert({
        sweepstakes_id: sw.id,
        name: productName,
        description:
          String(formData.get("product_description") ?? "").trim() || null,
        price_cents:
          Math.round(Number(formData.get("product_price") ?? 0) * 100) ||
          cfg.entry_price_cents,
        requires_shipping: !!formData.get("product_shipping"),
        images: [],
        offers: [],
        active: true,
      });
    }

    await admin.from("audit_log").insert({
      actor: userId,
      action: "sweepstakes.create",
      target: sw.id,
      detail: { name: cfg.name, slug: cfg.slug },
    });
    created = true;
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
  if (created) {
    revalidatePath("/admin/sweepstakes");
    redirect("/admin/sweepstakes");
  }
  return { ok: true, message: "Created." };
}

export async function updateSweepstakes(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const { userId } = await requireStaff("sweepstakes");
    const id = String(formData.get("id"));
    const cfg = parseConfig(formData);
    const admin = createAdminClient();

    const { error } = await admin
      .from("sweepstakes")
      .update({
        name: cfg.name,
        slug: cfg.slug,
        description: cfg.description,
        season_label: cfg.season_label,
        visibility: cfg.visibility,
        pool_size: cfg.pool_size,
        entry_price_cents: cfg.entry_price_cents,
        payout_structure: cfg.payout_structure,
        side_pots: cfg.side_pots,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    // Sports config is locked once a draw exists
    const { data: draw } = await admin
      .from("draws")
      .select("id")
      .eq("sweepstakes_id", id)
      .neq("status", "voided")
      .maybeSingle();
    if (!draw) {
      await admin.from("sweepstakes_sports").delete().eq("sweepstakes_id", id);
      await admin.from("sweepstakes_sports").insert(
        cfg.sports.map((s) => ({ ...s, sweepstakes_id: id })),
      );
    }

    await admin.from("audit_log").insert({
      actor: userId,
      action: "sweepstakes.update",
      target: id,
      detail: { name: cfg.name },
    });

    revalidatePath("/admin/sweepstakes");
    revalidatePath(`/s/${cfg.slug}`, "layout");
    return {
      ok: true,
      message: draw
        ? "Saved. (Sports/picks locked — a draw already exists.)"
        : "Saved.",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

const STATUSES = [
  "draft",
  "enrolling",
  "full",
  "drawing",
  "active",
  "completed",
  "archived",
] as const;

export async function addProduct(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireStaff("sweepstakes");
    const sweepstakesId = String(formData.get("sweepstakes_id"));
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, message: "Product name required." };

    const admin = createAdminClient();
    const { error } = await admin.from("products").insert({
      sweepstakes_id: sweepstakesId,
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      price_cents: Math.round(Number(formData.get("price") ?? 0) * 100),
      requires_shipping: !!formData.get("shipping"),
      images: [],
      offers: [],
      active: true,
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/sweepstakes");
    revalidatePath("/admin/products");
    return { ok: true, message: `${name} added — photos & offers on the Products tab.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

export async function cloneProduct(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireStaff("sweepstakes");
    const sweepstakesId = String(formData.get("sweepstakes_id"));
    const sourceId = String(formData.get("source_product_id"));
    if (!sourceId) return { ok: false, message: "Pick a product to copy." };

    const admin = createAdminClient();
    const { data: src } = await admin
      .from("products")
      .select("name,description,price_cents,requires_shipping,images,offers")
      .eq("id", sourceId)
      .single();
    if (!src) return { ok: false, message: "Source product not found." };

    const { error } = await admin.from("products").insert({
      ...src,
      sweepstakes_id: sweepstakesId,
      active: true,
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/sweepstakes");
    revalidatePath("/admin/products");
    return { ok: true, message: `Copied "${src.name}" (photos & offers included).` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

export async function openNextSeasonAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const { userId } = await requireStaff("sweepstakes");
    const { openNextSeason } = await import("@/lib/renewals");
    const name = String(formData.get("name") ?? "").trim();
    let slug = String(formData.get("slug") ?? "").trim().toLowerCase();
    if (!slug)
      slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const deadline = String(formData.get("deadline") ?? "");
    if (!name || !deadline)
      return { ok: false, message: "Name and renewal deadline required." };

    const result = await openNextSeason({
      priorSweepstakesId: String(formData.get("prior_id")),
      name,
      slug,
      seasonLabel: String(formData.get("season_label") ?? "").trim() || null,
      renewalDeadline: new Date(deadline).toISOString(),
      actorId: userId,
    });
    revalidatePath("/admin/sweepstakes");
    return {
      ok: true,
      message: `${name} created (enrolling) — ${result.reserved} spots reserved and renewal emails sent.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

export async function refundEntry(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const { userId } = await requireStaff("sweepstakes");
    const entryId = String(formData.get("entry_id"));
    const admin = createAdminClient();

    const { data: entry } = await admin
      .from("entries")
      .select("id,display_name,status,sweepstakes_id,order_id,source,orders(stripe_session_id,amount_cents,status)")
      .eq("id", entryId)
      .single();
    if (!entry) return { ok: false, message: "Entry not found." };
    if (entry.status !== "active")
      return { ok: false, message: "Entry is not active." };

    const order = entry.orders as unknown as {
      stripe_session_id: string | null;
      amount_cents: number;
      status: string;
    } | null;

    // Stripe refund for purchased entries; AMOE/admin entries just withdraw
    if (order?.stripe_session_id && order.status === "paid") {
      const { getStripe } = await import("@/lib/stripe");
      const session = await getStripe().checkout.sessions.retrieve(
        order.stripe_session_id,
      );
      if (typeof session.payment_intent === "string") {
        await getStripe().refunds.create({
          payment_intent: session.payment_intent,
        });
      }
      await admin
        .from("orders")
        .update({ status: "refunded" })
        .eq("id", entry.order_id);
      await admin.from("pot_ledger").insert({
        sweepstakes_id: entry.sweepstakes_id,
        type: "refund",
        amount_cents: -order.amount_cents,
        ref_order_id: entry.order_id,
      });
    }

    await admin.from("entries").update({ status: "refunded" }).eq("id", entryId);
    await admin.from("audit_log").insert({
      actor: userId,
      action: "entry.refund",
      target: entryId,
      detail: { display_name: entry.display_name, stripe: !!order?.stripe_session_id },
    });

    // Spot opened — notify the first person on the waitlist (best-effort)
    try {
      const { data: next } = await admin
        .from("waitlist")
        .select("id,user_id,sweepstakes:sweepstakes_id(name,slug)")
        .eq("sweepstakes_id", entry.sweepstakes_id)
        .is("notified_at", null)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (next) {
        const { data: u } = await admin.auth.admin.getUserById(next.user_id);
        const sw = next.sweepstakes as unknown as { name: string; slug: string };
        if (u?.user?.email) {
          const { sendEmail, p, cta, SITE } = await import("@/lib/email");
          await sendEmail(
            u.user.email,
            `A spot just opened in ${sw.name}!`,
            "You're up! 🔔",
            p(`You're first on the waitlist and a spot just opened in <strong>${sw.name}</strong>. Spots go to whoever completes purchase first — don't sit on it.`) +
              cta(`${SITE}/s/${sw.slug}`, "Grab the spot"),
          );
        }
        await admin
          .from("waitlist")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", next.id);
      }
    } catch {
      // waitlist table may not exist yet (migration 0006)
    }

    revalidatePath("/admin/sweepstakes");
    return {
      ok: true,
      message: `${entry.display_name} refunded — spot reopened.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Refund failed." };
  }
}

export async function toggleProductActive(formData: FormData): Promise<void> {
  await requireStaff("sweepstakes");
  const id = String(formData.get("product_id"));
  const active = formData.get("active") === "true";
  const admin = createAdminClient();
  await admin.from("products").update({ active }).eq("id", id);
  revalidatePath("/admin/sweepstakes");
  revalidatePath("/admin/products");
}

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
