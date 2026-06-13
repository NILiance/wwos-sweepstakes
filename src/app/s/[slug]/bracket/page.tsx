import Link from "next/link";
import { notFound } from "next/navigation";
import { poolAccess } from "@/lib/pool-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bracketLeaderboard } from "@/lib/bracket-score";
import type { BracketField } from "@/lib/bracket";
import { BracketPicker } from "./bracket-picker";

export const revalidate = 0;

export default async function BracketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await poolAccess(slug)).allowed) return null;
  const admin = createAdminClient();

  const { data: sw } = await admin
    .from("sweepstakes")
    .select("id,name,slug,status,game_mode,draw_at,bracket_field")
    .eq("slug", slug)
    .single();
  if (!sw) notFound();

  if (sw.game_mode !== "bracket") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center text-muted">
        This pool isn&apos;t a bracket challenge.
      </div>
    );
  }
  const field = sw.bracket_field as BracketField | null;
  if (!field) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center text-muted">
        The bracket field hasn&apos;t been published yet — check back at
        Selection Sunday.
      </div>
    );
  }

  // team name map
  const teamIds = field.regions.flatMap((r) => r.teams.map((t) => t.teamId));
  const { data: teams } = await admin
    .from("teams")
    .select("id,abbrev,name")
    .in("id", teamIds);
  const teamNames: Record<string, string> = {};
  for (const t of teams ?? []) teamNames[t.id] = t.abbrev || t.name;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // my entry + bracket (if any)
  let myBracketPicks: Record<number, string> = {};
  let myTiebreaker: number | null = null;
  let myEntryId: string | null = null;
  if (user) {
    const { data: entry } = await admin
      .from("entries")
      .select("id")
      .eq("sweepstakes_id", sw.id)
      .eq("owner_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    myEntryId = entry?.id ?? null;
    if (entry) {
      const { data: br } = await admin
        .from("brackets")
        .select("id,tiebreaker_total")
        .eq("entry_id", entry.id)
        .maybeSingle();
      if (br) {
        myTiebreaker = br.tiebreaker_total;
        const { data: picks } = await admin
          .from("bracket_picks")
          .select("slot,picked_team_id")
          .eq("bracket_id", br.id);
        for (const p of picks ?? [])
          myBracketPicks[p.slot] = p.picked_team_id;
      }
    }
  }

  const locked =
    sw.status !== "enrolling" ||
    (!!sw.draw_at && new Date(sw.draw_at) <= new Date());

  const { rows: leaderboard, truthFilled } = await bracketLeaderboard(sw.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Your Bracket</h1>
      <p className="mt-1 text-sm text-muted">
        {locked
          ? "Picks are locked — follow the results below."
          : "Pick a winner in every game, all the way to the champion."}
      </p>

      {myEntryId ? (
        <div className="mt-6">
          <BracketPicker
            field={field}
            initialPicks={myBracketPicks}
            locked={locked}
            teamNames={teamNames}
            tiebreaker={myTiebreaker}
          />
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-surface p-8 text-center text-muted">
          You need an entry in this pool to fill a bracket.{" "}
          <Link href={`/s/${sw.slug}`} className="text-info hover:underline">
            Get in →
          </Link>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <section className="mt-10">
          <h2 className="font-bold">
            Leaderboard{" "}
            <span className="text-sm font-normal text-muted">
              ({truthFilled} games decided)
            </span>
          </h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
            {leaderboard.map((row, i) => (
              <div
                key={row.entryId ?? i}
                className="flex items-center justify-between border-b border-border px-5 py-3 text-sm last:border-0"
              >
                <span>
                  <span className="mr-3 font-bold text-muted">{i + 1}</span>
                  {row.name}
                </span>
                <span className="flex items-center gap-4">
                  <span className="text-xs text-muted">
                    {row.correct} correct · max {row.maxPossible}
                  </span>
                  <span className="text-lg font-extrabold">{row.points}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
