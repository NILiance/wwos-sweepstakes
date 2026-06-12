import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { SyncButton } from "./sync-button";

export const metadata = { title: "Data Ops — Admin" };
export const revalidate = 0;

export default async function DataOpsPage() {
  await requireStaff("dataops");
  const admin = createAdminClient();

  const [{ data: sports }, { data: alerts }, { data: recent }] =
    await Promise.all([
      admin.from("sports").select("id,name").order("sort_order"),
      admin
        .from("data_alerts")
        .select("id,type,detail,status,created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("games")
        .select(
          "sport_id,status,starts_at,meta,broadcast,home:teams!games_home_team_id_fkey(abbrev),away:teams!games_away_team_id_fkey(abbrev),winner:teams!games_winner_team_id_fkey(abbrev)",
        )
        .eq("status", "final")
        .order("starts_at", { ascending: false })
        .limit(12),
    ]);

  const counts = await Promise.all(
    (sports ?? []).map(async (s) => {
      const { count } = await admin
        .from("games")
        .select("id", { count: "exact", head: true })
        .eq("sport_id", s.id);
      return [s.id, count ?? 0] as const;
    }),
  );

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Ingestion</h2>
            <p className="mt-1 text-sm text-muted">
              Central repository — one sync feeds every sweepstakes. Daily auto
              sync at 9:00 UTC; run manually any time.
            </p>
          </div>
          <SyncButton />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {counts.map(([id, count]) => (
            <span
              key={id}
              className="rounded-full bg-surface-raised px-3 py-1 text-xs"
            >
              <span className="font-bold uppercase text-info">{id}</span>{" "}
              <span className="text-muted">{count} games</span>
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="font-bold">
          Open alerts{" "}
          <span className="text-sm font-normal text-muted">
            ({alerts?.length ?? 0})
          </span>
        </h2>
        {(alerts ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted">No open alerts. 🎉</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {(alerts ?? []).map((a) => (
              <li key={a.id} className="rounded-md bg-surface-raised px-4 py-2">
                <span className="font-semibold uppercase text-brand-red">
                  {a.type}
                </span>{" "}
                <span className="text-muted">{a.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="font-bold">Latest finals</h2>
        <div className="mt-3 divide-y divide-border text-sm">
          {(recent ?? []).map((g, i) => {
            const meta = g.meta as { home_score?: number; away_score?: number } | null;
            const bc = g.broadcast as { network?: string } | null;
            return (
              <div key={i} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-bold uppercase text-info">
                    {g.sport_id}
                  </span>{" "}
                  {(g.away as unknown as { abbrev: string })?.abbrev}{" "}
                  {meta?.away_score} @{" "}
                  {(g.home as unknown as { abbrev: string })?.abbrev}{" "}
                  {meta?.home_score}
                </span>
                <span className="text-muted">
                  W: {(g.winner as unknown as { abbrev: string })?.abbrev ?? "—"}
                  {bc?.network ? ` · ${bc.network}` : ""}
                </span>
              </div>
            );
          })}
          {(recent ?? []).length === 0 && (
            <p className="py-2 text-muted">No finals ingested yet — run a sync.</p>
          )}
        </div>
      </section>
    </div>
  );
}
