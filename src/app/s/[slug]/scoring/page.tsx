import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 0;

export default async function ScoringGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: sw } = await supabase
    .from("sweepstakes")
    .select("id,name,slug,sweepstakes_sports(sport_id,sports(name,sort_order))")
    .eq("slug", slug)
    .single();

  if (!sw) notFound();

  const sportIds = (
    sw.sweepstakes_sports as unknown as { sport_id: string }[]
  ).map((s) => s.sport_id);

  // Sweepstakes-specific rules override platform defaults (null sweepstakes_id)
  const { data: rules } = await supabase
    .from("scoring_rules")
    .select("sweepstakes_id,sport_id,rule_key,label,points,scope")
    .or(`sweepstakes_id.is.null,sweepstakes_id.eq.${sw.id}`)
    .in("sport_id", sportIds);

  // Defaults first, then per-sweepstakes overrides replace them
  const effective = new Map<string, NonNullable<typeof rules>[number]>();
  for (const r of (rules ?? []).filter((r) => r.sweepstakes_id === null))
    effective.set(`${r.sport_id}:${r.rule_key}:${r.scope}`, r);
  for (const r of (rules ?? []).filter((r) => r.sweepstakes_id !== null))
    effective.set(`${r.sport_id}:${r.rule_key}:${r.scope}`, r);

  const sportsMeta = (
    sw.sweepstakes_sports as unknown as {
      sport_id: string;
      sports: { name: string; sort_order: number };
    }[]
  ).sort((a, b) => a.sports.sort_order - b.sports.sort_order);

  const bySport = sportsMeta.map((s) => ({
    id: s.sport_id,
    name: s.sports.name,
    rules: [...effective.values()]
      .filter((r) => r.sport_id === s.sport_id)
      .sort((a, b) =>
        a.rule_key === "regular" ? -1 : b.rule_key === "regular" ? 1 : a.points - b.points,
      ),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link
        href={`/s/${sw.slug}`}
        className="text-sm text-muted hover:text-foreground"
      >
        ← {sw.name}
      </Link>
      <h1 className="mt-3 text-3xl font-bold">How points work</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Every win your teams record earns points. Playoff rounds, bowls,
        majors and championships pay more. Highest total at season&apos;s end
        wins the pot.
      </p>

      <div className="mt-10 space-y-8">
        {bySport.map((s) => (
          <section
            key={s.id}
            className="rounded-lg border border-border bg-surface p-6"
          >
            <h2 className="text-lg font-bold">{s.name}</h2>
            <div className="mt-3 divide-y divide-border">
              {s.rules.map((r) => (
                <div
                  key={`${r.rule_key}:${r.scope}`}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="text-sm">
                    {r.label}
                    {r.scope !== "full_game" && (
                      <span className="ml-2 text-xs uppercase text-muted">
                        {r.scope}
                      </span>
                    )}
                  </span>
                  <span className="font-bold text-info">+{r.points}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
