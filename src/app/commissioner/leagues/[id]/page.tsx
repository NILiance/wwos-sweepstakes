import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLeagueAccess } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { SweepstakesForm } from "@/app/admin/sweepstakes/sweepstakes-form";
import { usd } from "@/lib/format";
import { LeagueTabs } from "./league-tabs";
import { EntrantForm, PaymentForm, StatusControl } from "./manage-forms";

export const metadata = { title: "Manage League — Commissioner" };
export const revalidate = 0;

export default async function ManageLeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireLeagueAccess(id);
  const admin = createAdminClient();

  const { data: sw } = await admin
    .from("sweepstakes")
    .select(
      "id,name,slug,description,season_label,visibility,game_mode,status,pool_size,entry_price_cents,payout_structure,side_pots,sweepstakes_sports(sport_id,picks_per_entry)",
    )
    .eq("id", id)
    .single();
  if (!sw) notFound();

  const [{ data: entries }, { data: payments }] = await Promise.all([
    admin
      .from("entries")
      .select("id,display_name,status")
      .eq("sweepstakes_id", id)
      .eq("status", "active")
      .order("created_at"),
    admin
      .from("league_payments")
      .select("id,payer_name,amount_cents,method,status,note,created_at")
      .eq("sweepstakes_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const collected = (payments ?? [])
    .filter((p) => p.status === "received")
    .reduce((n, p) => n + p.amount_cents, 0);

  const settingsTab = (
    <SweepstakesForm
      values={{
        id: sw.id,
        name: sw.name,
        slug: sw.slug,
        description: sw.description ?? undefined,
        season_label: sw.season_label ?? undefined,
        visibility: sw.visibility,
        pool_size: sw.pool_size,
        entry_price_cents: sw.entry_price_cents,
        payout_structure: sw.payout_structure as never,
        side_pots: sw.side_pots as never,
        sports: sw.sweepstakes_sports as never,
      }}
    />
  );

  const entrantsTab = (
    <div className="space-y-6">
      <StatusControl sweepstakesId={sw.id} status={sw.status} />
      <section className="rounded-lg border border-border bg-surface p-5">
        <h3 className="font-bold">
          Entrants{" "}
          <span className="text-sm font-normal text-muted">
            {(entries ?? []).length} of {sw.pool_size}
          </span>
        </h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(entries ?? []).map((e) => (
            <span
              key={e.id}
              className="rounded-full bg-surface-raised px-2.5 py-1 text-xs"
            >
              {e.display_name}
            </span>
          ))}
          {(entries ?? []).length === 0 && (
            <p className="text-sm text-muted">No entrants yet.</p>
          )}
        </div>
        <EntrantForm sweepstakesId={sw.id} />
      </section>
    </div>
  );

  const paymentsTab = (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h3 className="font-bold">
        Payments received{" "}
        <span className="text-sm font-normal text-muted">
          {usd(collected)} collected
        </span>
      </h3>
      <p className="mt-1 text-xs text-muted">
        You collect entry money your own way — log receipts here for your own
        records. No funds move through the platform.
      </p>
      <PaymentForm
        sweepstakesId={sw.id}
        entrants={(entries ?? []).map((e) => ({ id: e.id, name: e.display_name }))}
      />
      <div className="mt-4 divide-y divide-border">
        {(payments ?? []).map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2 text-sm">
            <span>
              <span className="font-semibold">{p.payer_name}</span>
              {p.method && <span className="ml-2 text-muted">{p.method}</span>}
              {p.status !== "received" && (
                <span className="ml-2 text-xs uppercase text-brand-red">
                  {p.status}
                </span>
              )}
            </span>
            <span className="font-bold">{usd(p.amount_cents)}</span>
          </div>
        ))}
        {(payments ?? []).length === 0 && (
          <p className="py-2 text-sm text-muted">No payments logged yet.</p>
        )}
      </div>
    </section>
  );

  const runTab = (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-5 text-sm">
      <p className="text-muted">Run and configure your league:</p>
      <div className="flex flex-wrap gap-3">
        {sw.game_mode === "bracket" ? (
          <Link
            href={`/commissioner/leagues/${sw.id}/bracket`}
            className="rounded-md bg-accent px-4 py-2 font-semibold text-white hover:bg-accent-hover"
          >
            🏀 Bracket control
          </Link>
        ) : (
          <Link
            href={`/commissioner/leagues/${sw.id}/draw`}
            className="rounded-md bg-accent px-4 py-2 font-semibold text-white hover:bg-accent-hover"
          >
            🎰 Draw control
          </Link>
        )}
        <Link
          href={`/commissioner/leagues/${sw.id}/scoring`}
          className="rounded-md border border-border px-4 py-2 font-semibold hover:bg-surface-raised"
        >
          🔢 Scoring
        </Link>
        {sw.game_mode !== "bracket" && (
          <Link
            href={`/commissioner/leagues/${sw.id}/pool`}
            className="rounded-md border border-border px-4 py-2 font-semibold hover:bg-surface-raised"
          >
            🎯 Draw pool
          </Link>
        )}
        <Link
          href={`/s/${sw.slug}`}
          className="rounded-md border border-border px-4 py-2 font-semibold hover:bg-surface-raised"
        >
          View league page →
        </Link>
      </div>
    </div>
  );

  return (
    <div>
      <Link href="/commissioner" className="text-sm text-muted hover:text-foreground">
        ← My leagues
      </Link>
      <h2 className="mt-2 text-lg font-bold">
        {sw.name}{" "}
        <span className="text-sm font-normal text-muted">({sw.status})</span>
      </h2>
      <LeagueTabs
        tabs={[
          { key: "run", label: "▶ Run", content: runTab },
          { key: "entrants", label: "👥 Entrants", content: entrantsTab },
          { key: "payments", label: "💵 Payments", content: paymentsTab },
          { key: "settings", label: "⚙ Settings", content: settingsTab },
        ]}
      />
    </div>
  );
}
