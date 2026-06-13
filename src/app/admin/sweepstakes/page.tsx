import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { usd } from "@/lib/format";
import { setStatus } from "./actions";
import { AmoeForm } from "./amoe-form";
import { RefundButton } from "./refund-button";
import { NextSeasonForm } from "./next-season-form";

export const metadata = { title: "Sweepstakes — Admin" };
export const revalidate = 0;

const STATUSES = [
  "draft",
  "enrolling",
  "full",
  "drawing",
  "active",
  "completed",
  "archived",
];

export default async function AdminSweepstakes() {
  const admin = createAdminClient();
  const { data: pools } = await admin
    .from("sweepstakes")
    .select(
      "id,name,slug,status,visibility,pool_size,entry_price_cents,season_label,entries(id,display_name,source,status)",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          href="/admin/sweepstakes/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          + New sweepstakes
        </Link>
      </div>
      {(pools ?? []).map((p) => {
        const active = (p.entries ?? []).filter(
          (e: { status: string }) => e.status === "active",
        );
        return (
          <div
            key={p.id}
            className="rounded-lg border border-border bg-surface p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">
                  <Link href={`/s/${p.slug}`} className="hover:text-info">
                    {p.name}
                  </Link>{" "}
                  <span className="text-sm font-normal text-muted">
                    {p.season_label} · {p.visibility} ·{" "}
                    {usd(p.entry_price_cents)} entry
                  </span>
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {active.length} of {p.pool_size} entries
                </p>
              </div>
              <form action={setStatus} className="flex items-center gap-2">
                <input type="hidden" name="id" value={p.id} />
                <select
                  name="status"
                  defaultValue={p.status}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-raised"
                >
                  Set status
                </button>
              </form>
            </div>

            {active.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {active.map(
                  (e: { id: string; display_name: string; source: string }) => (
                    <span
                      key={e.id}
                      className="rounded-full bg-surface-raised px-2.5 py-0.5 text-xs"
                    >
                      {e.display_name}
                      {e.source === "amoe" && (
                        <span className="ml-1 text-info" title="Mail-in entry">
                          ✉
                        </span>
                      )}
                      <RefundButton entryId={e.id} name={e.display_name} />
                    </span>
                  ),
                )}
              </div>
            )}

            <div className="mt-4 flex items-center gap-4">
              <Link
                href={`/admin/draw/${p.id}`}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-info hover:bg-surface-raised"
              >
                🎰 Draw Control
              </Link>
              <Link
                href={`/admin/sweepstakes/${p.id}/edit`}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-raised"
              >
                ✎ Edit
              </Link>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-info">
                Add mail-in (AMOE) entry
              </summary>
              <AmoeForm sweepstakesId={p.id} />
            </details>

            {["active", "completed"].includes(p.status) && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium text-info">
                  🔁 Open next season (reserve returning entrants)
                </summary>
                <NextSeasonForm priorId={p.id} priorName={p.name} />
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
