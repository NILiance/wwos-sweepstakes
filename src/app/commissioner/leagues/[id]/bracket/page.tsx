import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLeagueAccess } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BracketField } from "@/lib/bracket";
import { BracketPicker } from "@/app/s/[slug]/bracket/bracket-picker";
import { GenerateFieldButton } from "@/app/admin/sweepstakes/[id]/bracket/generate-button";

export const metadata = { title: "Bracket Control — Commissioner" };
export const revalidate = 0;

export default async function CommissionerBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireLeagueAccess(id);
  const admin = createAdminClient();

  const { data: sw } = await admin
    .from("sweepstakes")
    .select("id,name,slug,game_mode,bracket_field")
    .eq("id", id)
    .single();
  if (!sw) notFound();

  if (sw.game_mode !== "bracket") {
    return (
      <div className="max-w-xl">
        <Link
          href={`/commissioner/leagues/${id}`}
          className="text-sm text-muted hover:text-foreground"
        >
          ← Manage league
        </Link>
        <h2 className="mt-2 text-lg font-bold">Bracket control</h2>
        <p className="mt-2 text-sm text-muted">
          This league&apos;s game mode is{" "}
          <span className="font-semibold">{sw.game_mode}</span>, not a bracket
          challenge.
        </p>
      </div>
    );
  }

  const field = sw.bracket_field as BracketField | null;

  const teamNames: Record<string, string> = {};
  const truthPicks: Record<number, string> = {};
  if (field) {
    const ids = field.regions.flatMap((r) => r.teams.map((t) => t.teamId));
    const { data: teams } = await admin
      .from("teams")
      .select("id,abbrev,name")
      .in("id", ids);
    for (const t of teams ?? []) teamNames[t.id] = t.abbrev || t.name;

    const { data: truth } = await admin
      .from("brackets")
      .select("id")
      .eq("sweepstakes_id", id)
      .eq("is_truth", true)
      .maybeSingle();
    if (truth) {
      const { data: picks } = await admin
        .from("bracket_picks")
        .select("slot,picked_team_id")
        .eq("bracket_id", truth.id);
      for (const p of picks ?? []) truthPicks[p.slot] = p.picked_team_id;
    }
  }

  return (
    <div>
      <Link
        href={`/commissioner/leagues/${id}`}
        className="text-sm text-muted hover:text-foreground"
      >
        ← Manage league
      </Link>
      <h2 className="mt-2 text-lg font-bold">Bracket control — {sw.name}</h2>

      {!field ? (
        <div className="mt-4 max-w-xl rounded-lg border border-border bg-surface p-6">
          <p className="text-sm text-muted">
            Generate the 64-team field to open bracket entry. It seeds the top
            college-basketball teams into four regions — refine seeds and
            regions as the real bracket is announced.
          </p>
          <div className="mt-4">
            <GenerateFieldButton sweepstakesId={sw.id} />
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            Field is live. Advance the <strong>truth bracket</strong> by
            clicking real winners as games finish.{" "}
            <Link href={`/s/${sw.slug}/bracket`} className="text-info hover:underline">
              View public bracket →
            </Link>
          </p>
          <div className="mt-6">
            <BracketPicker
              field={field}
              initialPicks={truthPicks}
              locked={false}
              teamNames={teamNames}
              tiebreaker={null}
              mode="truth"
              sweepstakesId={sw.id}
            />
          </div>
        </>
      )}
    </div>
  );
}
