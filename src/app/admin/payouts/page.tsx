import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { usd, ordinal } from "@/lib/format";
import { GenerateButton, AdvanceButton, W9Toggle } from "./payout-controls";

export const metadata = { title: "Payout Center — Admin" };
export const revalidate = 0;

export default async function PayoutCenter() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: pools } = await admin
    .from("sweepstakes")
    .select("id,name,slug,status,pool_size,entry_price_cents,house_cut_pct,payout_structure")
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: false });

  const { data: payouts } = await admin
    .from("payouts")
    .select(
      "id,sweepstakes_id,place,amount_cents,status,tax_doc_status,entries(display_name,owner_user_id)",
    )
    .order("place");

  // payout accounts for winners
  const ownerIds = [
    ...new Set(
      (payouts ?? []).map(
        (p) => (p.entries as unknown as { owner_user_id: string })?.owner_user_id,
      ),
    ),
  ].filter(Boolean);
  const { data: accounts } = ownerIds.length
    ? await admin
        .from("payout_accounts")
        .select("user_id,method,identifier,is_preferred")
        .in("user_id", ownerIds)
    : { data: [] };

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">
        Generate payouts from final standings, collect W-9s for $600+, and
        track each prize to “sent.” Automated PayPal/Venmo batch disbursement
        activates once PayPal API credentials are configured.
      </p>

      {(pools ?? []).map((pool) => {
        const rows = (payouts ?? []).filter((p) => p.sweepstakes_id === pool.id);
        const pot = pool.pool_size * pool.entry_price_cents;
        return (
          <section key={pool.id} className="rounded-lg border border-border bg-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">{pool.name}</h2>
                <p className="text-sm text-muted">
                  {pool.status} · pot {usd(pot)}
                  {Number(pool.house_cut_pct) > 0 && ` · house ${pool.house_cut_pct}%`}
                </p>
              </div>
              {rows.length === 0 && <GenerateButton sweepstakesId={pool.id} />}
            </div>

            {rows.length > 0 && (
              <div className="mt-4 divide-y divide-border">
                {rows.map((p) => {
                  const entry = p.entries as unknown as {
                    display_name: string;
                    owner_user_id: string;
                  };
                  const acct =
                    (accounts ?? []).find(
                      (a) => a.user_id === entry?.owner_user_id && a.is_preferred,
                    ) ??
                    (accounts ?? []).find((a) => a.user_id === entry?.owner_user_id);
                  return (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <span className="w-10 font-extrabold text-brand-red">
                        {ordinal(p.place ?? 0)}
                      </span>
                      <span className="flex-1 font-semibold">{entry?.display_name}</span>
                      <span className="text-muted">
                        {acct ? `${acct.method}: ${acct.identifier}` : "no payout method on file"}
                      </span>
                      <W9Toggle payoutId={p.id} status={p.tax_doc_status} />
                      <span className="w-24 text-right font-bold">{usd(p.amount_cents)}</span>
                      <span
                        className={`w-20 text-center text-xs font-bold uppercase ${
                          p.status === "sent"
                            ? "text-info"
                            : p.status === "approved"
                              ? "text-foreground"
                              : "text-muted"
                        }`}
                      >
                        {p.status}
                      </span>
                      <AdvanceButton
                        payoutId={p.id}
                        status={p.status}
                        blocked={p.tax_doc_status === "requested"}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      {(pools ?? []).length === 0 && (
        <p className="text-muted">No active or completed pools yet.</p>
      )}
    </div>
  );
}
