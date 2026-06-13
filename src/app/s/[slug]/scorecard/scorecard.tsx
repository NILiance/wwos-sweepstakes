import Link from "next/link";
import { usd, ordinal } from "@/lib/format";

type Row = {
  id: string;
  name: string;
  total: number;
  rank: number;
  bySport: Record<string, number>;
  payoutCents: number | null;
};

export function Scorecard({
  slug,
  sports,
  rows,
}: {
  slug: string;
  sports: { id: string; label: string }[];
  rows: Row[];
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-8 rounded-lg border border-border bg-surface p-8 text-center text-muted">
        No entries yet.
      </p>
    );
  }

  // Column high score per sport (the "leader" in each sport) for highlighting
  const sportMax = new Map<string, number>();
  for (const s of sports) {
    sportMax.set(s.id, Math.max(0, ...rows.map((r) => r.bySport[s.id] ?? 0)));
  }

  return (
    <div className="mt-6 flex flex-col gap-6 lg:flex-row">
      {/* Matrix */}
      <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-raised text-xs uppercase tracking-wide text-muted">
              <th className="sticky left-0 z-10 bg-surface-raised px-4 py-3 text-left">
                Entrant
              </th>
              {sports.map((s) => (
                <th key={s.id} className="px-3 py-3 text-center font-semibold">
                  {s.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border last:border-0 hover:bg-surface-raised"
              >
                <td className="sticky left-0 z-10 bg-surface px-4 py-3 font-semibold">
                  <Link
                    href={`/s/${slug}/entries/${r.id}`}
                    className="flex items-center gap-2 hover:text-accent"
                  >
                    <span className="w-6 text-xs font-bold text-muted">
                      {r.rank}
                    </span>
                    {r.name}
                  </Link>
                </td>
                {sports.map((s) => {
                  const pts = r.bySport[s.id] ?? 0;
                  const isMax = pts > 0 && pts === sportMax.get(s.id);
                  return (
                    <td
                      key={s.id}
                      className={`px-3 py-3 text-center tabular-nums ${
                        isMax
                          ? "font-bold text-accent"
                          : pts === 0
                            ? "text-muted"
                            : ""
                      }`}
                    >
                      {pts}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right text-base font-extrabold tabular-nums">
                  {r.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leaderboard */}
      <aside className="lg:w-72 lg:shrink-0">
        <div className="rounded-lg border border-border bg-surface lg:sticky lg:top-4">
          <h2 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide">
            Leaderboard
          </h2>
          <ol>
            {rows.map((r) => (
              <li
                key={r.id}
                className={`flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 ${
                  r.rank === 1 ? "bg-surface-raised" : ""
                }`}
              >
                <span
                  className={`w-8 text-base font-extrabold ${
                    r.payoutCents ? "text-brand-red" : "text-muted"
                  }`}
                >
                  {ordinal(r.rank)}
                </span>
                <Link
                  href={`/s/${slug}/entries/${r.id}`}
                  className="flex-1 truncate font-semibold hover:text-accent"
                >
                  {r.name}
                </Link>
                {r.payoutCents != null && (
                  <span className="text-xs font-semibold text-info">
                    {usd(r.payoutCents)}
                  </span>
                )}
                <span className="w-10 text-right font-extrabold tabular-nums">
                  {r.total}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
