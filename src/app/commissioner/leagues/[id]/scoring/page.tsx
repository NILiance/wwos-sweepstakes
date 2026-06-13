import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLeagueAccess } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ScoringMatrixForm,
  type SportRules,
} from "@/app/admin/sweepstakes/[id]/scoring/scoring-form";

export const metadata = { title: "Scoring Matrix — Commissioner" };
export const revalidate = 0;

const HALF_SPORTS = new Set(["cfb", "nfl", "cbb", "nba", "wnba"]);

export default async function CommissionerScoringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireLeagueAccess(id);
  const admin = createAdminClient();

  const { data: sw } = await admin
    .from("sweepstakes")
    .select("id,name,sweepstakes_sports(sport_id,sports(name,short_name,sort_order))")
    .eq("id", id)
    .single();
  if (!sw) notFound();

  const sportIds = (sw.sweepstakes_sports as unknown as { sport_id: string }[]).map(
    (s) => s.sport_id,
  );

  const { data: rules } = await admin
    .from("scoring_rules")
    .select("sweepstakes_id,sport_id,rule_key,label,points,scope")
    .or(`sweepstakes_id.is.null,sweepstakes_id.eq.${id}`)
    .in("sport_id", sportIds);

  type Rule = NonNullable<typeof rules>[number];
  const eff = new Map<string, Rule>();
  for (const r of (rules ?? []).filter((r) => r.sweepstakes_id === null))
    eff.set(`${r.sport_id}|${r.rule_key}|${r.scope}`, r);
  for (const r of (rules ?? []).filter((r) => r.sweepstakes_id !== null))
    eff.set(`${r.sport_id}|${r.rule_key}|${r.scope}`, r);

  const sportsMeta = (
    sw.sweepstakes_sports as unknown as {
      sport_id: string;
      sports: { name: string; short_name: string | null; sort_order: number };
    }[]
  ).sort((a, b) => a.sports.sort_order - b.sports.sort_order);

  const sportRules: SportRules[] = sportsMeta.map((s) => {
    const fullGame = [...eff.values()]
      .filter((r) => r.sport_id === s.sport_id && r.scope === "full_game")
      .sort((a, b) =>
        a.rule_key === "regular" ? -1 : b.rule_key === "regular" ? 1 : a.points - b.points,
      )
      .map((r) => ({
        rule_key: r.rule_key,
        label: r.label,
        points: r.points,
        overridden: (rules ?? []).some(
          (x) =>
            x.sweepstakes_id === id &&
            x.sport_id === r.sport_id &&
            x.rule_key === r.rule_key &&
            x.scope === "full_game",
        ),
      }));
    const half1 = eff.get(`${s.sport_id}|regular|half1`)?.points ?? 0;
    const half2 = eff.get(`${s.sport_id}|regular|half2`)?.points ?? 0;
    return {
      sportId: s.sport_id,
      name: s.sports.name,
      rules: fullGame,
      supportsHalf: HALF_SPORTS.has(s.sport_id),
      half1,
      half2,
    };
  });

  return (
    <div className="max-w-2xl">
      <Link
        href={`/commissioner/leagues/${id}`}
        className="text-sm text-muted hover:text-foreground"
      >
        ← Manage league
      </Link>
      <h2 className="mt-2 text-lg font-bold">Scoring matrix — {sw.name}</h2>
      <p className="mt-1 text-sm text-muted">
        Customize point values for this pool. Blank/unchanged values use the
        platform defaults. Half-win scoring is optional and applies on top of
        the full-game win.
      </p>
      <ScoringMatrixForm sweepstakesId={sw.id} sports={sportRules} />
    </div>
  );
}
