import { createAdminClient } from "@/lib/supabase/admin";

export type ActivityCategory = "pool" | "social" | "league" | "account";

export type ActivityItem = {
  at: string; // ISO timestamp
  icon: string;
  title: string;
  detail?: string;
  href?: string;
  category: ActivityCategory;
};

const money = (c: number) =>
  (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Best-effort: run a source query, map to items, never throw. */
async function safe(fn: () => Promise<ActivityItem[]>): Promise<ActivityItem[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

const AUDIT_LABELS: Record<string, { title: string; category: ActivityCategory }> = {
  "sweepstakes.create": { title: "Created a sweepstakes", category: "league" },
  "sweepstakes.update": { title: "Updated a sweepstakes", category: "league" },
  "sweepstakes.status": { title: "Changed a pool's status", category: "league" },
  "league.create": { title: "Created a league", category: "league" },
  "entry.refund": { title: "Refunded an entry", category: "league" },
  "draw.created": { title: "Ran a draw", category: "league" },
  "user.invite": { title: "Invited a player", category: "league" },
  "user.create": { title: "Created a user", category: "league" },
  "user.role": { title: "Changed a user's role", category: "league" },
  "user.set_password": { title: "Set a user's password", category: "league" },
  "user.delete": { title: "Deleted a user", category: "league" },
  "payouts.generate": { title: "Generated payouts", category: "league" },
  "branding.update": { title: "Updated branding", category: "league" },
  "game.manual_fix": { title: "Fixed a game result", category: "league" },
  "game.manual_add": { title: "Added a game", category: "league" },
  "simulator.reset": { title: "Reset the simulator", category: "league" },
  "user.login": { title: "Signed in", category: "account" },
};

type SwRef = { name: string; slug: string } | null;
const swName = (s: unknown): SwRef => (s as SwRef) ?? null;

/**
 * Build a reverse-chronological activity timeline for a user by aggregating
 * across the schema. Called server-side; the caller must authorize (owner or
 * admin). Uses the service-role client so it works for both self and admin
 * views.
 */
export async function getUserActivity(userId: string): Promise<ActivityItem[]> {
  const admin = createAdminClient();

  // Entries first — several sources key off the user's entry ids.
  const { data: entries } = await admin
    .from("entries")
    .select("id,created_at,source,status,display_name,sweepstakes(name,slug)")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
  const entryIds = (entries ?? []).map((e) => e.id);

  const sourceVerb: Record<string, string> = {
    purchase: "Bought in to",
    amoe: "Mail-in entered",
    self: "Registered for",
    admin: "Was added to",
  };

  const [
    points,
    orders,
    posts,
    disputes,
    shares,
    brackets,
    payoutAccts,
    waitlist,
    commishSub,
    leaguePays,
    leagueMsgs,
    audit,
  ] = await Promise.all([
    safe(async () => {
      if (!entryIds.length) return [];
      const { data } = await admin
        .from("point_events")
        .select("points,rule_key,created_at,teams(abbrev),entries!inner(sweepstakes(name,slug))")
        .in("entry_id", entryIds)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []).map((r) => {
        const sw = swName(
          (r.entries as unknown as { sweepstakes: SwRef })?.sweepstakes,
        );
        const team =
          (r.teams as unknown as { abbrev: string } | null)?.abbrev ?? "";
        return {
          at: r.created_at,
          icon: "🎯",
          title: `Scored +${r.points} ${team ? `— ${team}` : ""}`.trim(),
          detail: sw?.name,
          href: sw ? `/s/${sw.slug}/standings` : undefined,
          category: "pool" as const,
        };
      });
    }),
    safe(async () => {
      const { data } = await admin
        .from("orders")
        .select("amount_cents,status,created_at,products(name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? [])
        .filter((o) => o.status === "paid" || o.status === "refunded")
        .map((o) => ({
          at: o.created_at,
          icon: o.status === "refunded" ? "↩️" : "💳",
          title:
            o.status === "refunded"
              ? `Refunded ${money(o.amount_cents)}`
              : `Paid ${money(o.amount_cents)}`,
          detail: (o.products as unknown as { name: string } | null)?.name,
          category: "account" as const,
        }));
    }),
    safe(async () => {
      const { data } = await admin
        .from("posts")
        .select("body,created_at,sweepstakes(name,slug)")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []).map((pst) => {
        const sw = swName(pst.sweepstakes);
        return {
          at: pst.created_at,
          icon: "💬",
          title: "Posted smack talk",
          detail: `${sw ? `${sw.name}: ` : ""}"${String(pst.body).slice(0, 80)}"`,
          href: sw ? `/s/${sw.slug}/board` : undefined,
          category: "social" as const,
        };
      });
    }),
    safe(async () => {
      const { data } = await admin
        .from("disputes")
        .select("reason,status,created_at,entries(sweepstakes(name,slug))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []).map((d) => {
        const sw = swName(
          (d.entries as unknown as { sweepstakes: SwRef })?.sweepstakes,
        );
        return {
          at: d.created_at,
          icon: "⚖️",
          title: `Filed a dispute (${String(d.reason).replace(/_/g, " ")})`,
          detail: sw?.name,
          category: "social" as const,
        };
      });
    }),
    safe(async () => {
      const { data } = await admin
        .from("entry_shares")
        .select("invited_email,status,created_at,entries!inner(owner_user_id,sweepstakes(name,slug))")
        .eq("entries.owner_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []).map((s) => {
        const sw = swName(
          (s.entries as unknown as { sweepstakes: SwRef })?.sweepstakes,
        );
        return {
          at: s.created_at,
          icon: "🤝",
          title: "Invited a co-owner",
          detail: `${s.invited_email ?? ""}${sw ? ` · ${sw.name}` : ""}`,
          category: "social" as const,
        };
      });
    }),
    safe(async () => {
      if (!entryIds.length) return [];
      const { data } = await admin
        .from("brackets")
        .select("locked_at,sweepstakes(name,slug)")
        .in("entry_id", entryIds)
        .not("locked_at", "is", null);
      return (data ?? []).map((b) => {
        const sw = swName(b.sweepstakes);
        return {
          at: b.locked_at as string,
          icon: "🏀",
          title: "Submitted a bracket",
          detail: sw?.name,
          href: sw ? `/s/${sw.slug}/bracket` : undefined,
          category: "pool" as const,
        };
      });
    }),
    safe(async () => {
      const { data } = await admin
        .from("payout_accounts")
        .select("method,created_at")
        .eq("user_id", userId);
      return (data ?? []).map((a) => ({
        at: a.created_at,
        icon: "🏦",
        title: `Set up a payout method (${a.method})`,
        category: "account" as const,
      }));
    }),
    safe(async () => {
      const { data } = await admin
        .from("waitlist")
        .select("created_at,sweepstakes(name,slug)")
        .eq("user_id", userId);
      return (data ?? []).map((w) => {
        const sw = swName(w.sweepstakes);
        return {
          at: w.created_at,
          icon: "⏳",
          title: "Joined a waitlist",
          detail: sw?.name,
          href: sw ? `/s/${sw.slug}` : undefined,
          category: "pool" as const,
        };
      });
    }),
    safe(async () => {
      const { data } = await admin
        .from("commissioner_subscriptions")
        .select("status,created_at")
        .eq("user_id", userId);
      return (data ?? []).map((c) => ({
        at: c.created_at,
        icon: "🎟️",
        title: "Activated commissioner access",
        category: "league" as const,
      }));
    }),
    safe(async () => {
      const { data } = await admin
        .from("league_payments")
        .select("payer_name,amount_cents,created_at,sweepstakes(name,slug)")
        .eq("recorded_by", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []).map((pmt) => {
        const sw = swName(pmt.sweepstakes);
        return {
          at: pmt.created_at,
          icon: "💵",
          title: `Logged a payment (${money(pmt.amount_cents)})`,
          detail: `${pmt.payer_name}${sw ? ` · ${sw.name}` : ""}`,
          category: "league" as const,
        };
      });
    }),
    safe(async () => {
      const { data } = await admin
        .from("league_messages")
        .select("subject,recipient_count,created_at,sweepstakes(name,slug)")
        .eq("sent_by", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []).map((m) => {
        const sw = swName(m.sweepstakes);
        return {
          at: m.created_at,
          icon: "✉️",
          title: `Messaged members (${m.recipient_count} sent)`,
          detail: `${sw ? `${sw.name}: ` : ""}"${m.subject}"`,
          category: "league" as const,
        };
      });
    }),
    safe(async () => {
      const { data } = await admin
        .from("audit_log")
        .select("action,detail,created_at")
        .eq("actor", userId)
        .order("created_at", { ascending: false })
        .limit(60);
      return (data ?? [])
        .filter((a) => a.action !== "entry.amoe_create") // covered by entries
        .map((a) => {
          const meta = AUDIT_LABELS[a.action] ?? {
            title: a.action.replace(/[._]/g, " "),
            category: "league" as ActivityCategory,
          };
          const name = (a.detail as { name?: string } | null)?.name;
          return {
            at: a.created_at,
            icon: a.action === "user.login" ? "🔑" : "🛠️",
            title: meta.title,
            detail: name,
            category: meta.category,
          };
        });
    }),
  ]);

  const entryItems: ActivityItem[] = (entries ?? []).map((e) => {
    const sw = swName(e.sweepstakes);
    const verb = sourceVerb[e.source as string] ?? "Entered";
    return {
      at: e.created_at,
      icon: "🎫",
      title: `${verb} a pool${e.status === "refunded" ? " (refunded)" : ""}`,
      detail: sw?.name ?? e.display_name,
      href: sw ? `/s/${sw.slug}` : undefined,
      category: "pool",
    };
  });

  // Bootstrap a single "Signed in" from Supabase if we have no logged logins yet.
  const loginBootstrap: ActivityItem[] = await safe(async () => {
    if (audit.some((a) => a.icon === "🔑")) return [];
    const { data } = await admin.auth.admin.getUserById(userId);
    const last = data?.user?.last_sign_in_at;
    return last
      ? [{ at: last, icon: "🔑", title: "Signed in", category: "account" as const }]
      : [];
  });

  const all = [
    ...entryItems,
    ...points,
    ...orders,
    ...posts,
    ...disputes,
    ...shares,
    ...brackets,
    ...payoutAccts,
    ...waitlist,
    ...commishSub,
    ...leaguePays,
    ...leagueMsgs,
    ...audit,
    ...loginBootstrap,
  ].filter((i) => i.at);

  all.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return all.slice(0, 200);
}

/** Record a sign-in for the activity timeline. Best-effort. */
export async function logLogin(userId: string, method: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      actor: userId,
      action: "user.login",
      target: userId,
      detail: { method },
    });
  } catch {
    /* never block auth on logging */
  }
}
