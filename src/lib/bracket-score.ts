import { createAdminClient } from "@/lib/supabase/admin";
import { roundOfNode, type BracketField } from "@/lib/bracket";

/** Live bracket leaderboard: score each entrant bracket vs the truth bracket. */
export async function bracketLeaderboard(sweepstakesId: string) {
  const admin = createAdminClient();
  const { data: sw } = await admin
    .from("sweepstakes")
    .select("bracket_field")
    .eq("id", sweepstakesId)
    .single();
  const field = sw?.bracket_field as BracketField | null;
  const roundPoints = field?.roundPoints ?? [1, 2, 4, 8, 16, 32];

  const { data: brackets } = await admin
    .from("brackets")
    .select("id,entry_id,is_truth,tiebreaker_total,entries(display_name)")
    .eq("sweepstakes_id", sweepstakesId);
  if (!brackets?.length) return { rows: [], truthFilled: 0 };

  const truth = brackets.find((b) => b.is_truth);
  const { data: allPicks } = await admin
    .from("bracket_picks")
    .select("bracket_id,slot,picked_team_id,result")
    .in("bracket_id", brackets.map((b) => b.id));

  const byBracket = new Map<string, Map<number, string>>();
  for (const p of allPicks ?? []) {
    if (!byBracket.has(p.bracket_id)) byBracket.set(p.bracket_id, new Map());
    byBracket.get(p.bracket_id)!.set(p.slot, p.picked_team_id);
  }
  const truthPicks = truth ? byBracket.get(truth.id) ?? new Map() : new Map();

  const rows = brackets
    .filter((b) => !b.is_truth)
    .map((b) => {
      const picks = byBracket.get(b.id) ?? new Map();
      let points = 0;
      let correct = 0;
      let maxLeft = 0;
      for (const [slot, truthTeam] of truthPicks.entries()) {
        const pts = roundPoints[roundOfNode(slot) - 1] ?? 0;
        if (picks.get(slot) === truthTeam) {
          points += pts;
          correct++;
        }
      }
      // points still possible: rounds not yet decided where pick is still alive
      for (let slot = 1; slot <= 63; slot++) {
        if (truthPicks.has(slot)) continue; // decided
        const pts = roundPoints[roundOfNode(slot) - 1] ?? 0;
        if (picks.get(slot)) maxLeft += pts;
      }
      return {
        entryId: b.entry_id,
        name:
          (b.entries as unknown as { display_name: string })?.display_name ??
          "Entry",
        points,
        correct,
        maxPossible: points + maxLeft,
      };
    })
    .sort((a, b) => b.points - a.points || b.maxPossible - a.maxPossible);

  return { rows, truthFilled: truthPicks.size };
}
