type Team = { abbrev: string; name: string; points: number };
type Section = { sportId: string; label: string; teams: Team[]; subtotal: number };

/** A single entrant's golf-style scorecard: teams grouped by sport, points each. */
export function EntryScorecard({
  sections,
  total,
}: {
  sections: Section[];
  total: number;
}) {
  if (sections.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-surface p-6 text-sm text-muted">
        Your scorecard fills in once the roster is drawn and games are scored.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-raised text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-2.5 text-left">Sport</th>
            <th className="px-4 py-2.5 text-left">Team</th>
            <th className="px-4 py-2.5 text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => {
            const best = Math.max(0, ...s.teams.map((t) => t.points));
            return s.teams.map((t, i) => (
              <tr
                key={`${s.sportId}-${t.abbrev}-${i}`}
                className="border-b border-border/60"
              >
                {i === 0 && (
                  <td
                    rowSpan={s.teams.length}
                    className="border-r border-border px-4 py-2.5 align-top text-xs font-semibold uppercase tracking-wide text-info"
                  >
                    {s.label}
                    <span className="mt-1 block font-bold text-foreground">
                      {s.subtotal}
                    </span>
                  </td>
                )}
                <td className="px-4 py-2.5 font-semibold" title={t.name}>
                  {t.abbrev}
                </td>
                <td
                  className={`px-4 py-2.5 text-right tabular-nums ${
                    t.points > 0 && t.points === best
                      ? "font-bold text-accent"
                      : t.points === 0
                        ? "text-muted"
                        : ""
                  }`}
                >
                  {t.points}
                </td>
              </tr>
            ));
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-surface-raised">
            <td colSpan={2} className="px-4 py-3 text-right font-bold uppercase tracking-wide">
              Total
            </td>
            <td className="px-4 py-3 text-right text-lg font-extrabold tabular-nums">
              {total}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
