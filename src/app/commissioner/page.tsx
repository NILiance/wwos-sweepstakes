import Link from "next/link";
import { requireCommissioner } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/tz";

export const metadata = { title: "Commissioner HQ — WWOS" };
export const revalidate = 0;

export default async function CommissionerHome() {
  const { userId, active } = await requireCommissioner();
  const admin = createAdminClient();

  const [{ data: sub }, { data: leagues }, { data: profile }] =
    await Promise.all([
      admin
        .from("commissioner_subscriptions")
        .select("status,paid_through,amount_cents")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("sweepstakes")
        .select("id,name,slug,status,game_mode,pool_size,entries(count)")
        .eq("created_by", userId)
        .order("created_at", { ascending: false }),
      admin.from("profiles").select("timezone").eq("id", userId).single(),
    ]);
  const tz = profile?.timezone ?? "America/New_York";

  return (
    <div className="space-y-8">
      {/* Subscription */}
      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Your subscription</h2>
            <p className="mt-1 text-sm text-muted">
              {active ? (
                <>
                  Active
                  {sub?.paid_through && (
                    <> · renews {fmtDate(sub.paid_through, tz)}</>
                  )}
                </>
              ) : (
                "Inactive — renew to keep running leagues."
              )}
            </p>
          </div>
          {!active && (
            <Link
              href="/commissioner/join"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Renew now
            </Link>
          )}
        </div>
      </section>

      {/* Leagues */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">My leagues</h2>
          {active && (
            <Link
              href="/commissioner/leagues/new"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              + New league
            </Link>
          )}
        </div>
        {(leagues ?? []).length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border bg-surface p-8 text-center text-muted">
            No leagues yet. Create your first one to get started.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(leagues ?? []).map((l) => {
              const taken =
                (l.entries?.[0] as { count: number } | undefined)?.count ?? 0;
              return (
                <Link
                  key={l.id}
                  href={`/commissioner/leagues/${l.id}`}
                  className="group rounded-lg border border-border bg-surface p-5 transition hover:border-info"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold group-hover:text-info">{l.name}</h3>
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted">
                      {l.game_mode === "bracket" ? "Bracket" : l.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {taken} of {l.pool_size} entries
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
