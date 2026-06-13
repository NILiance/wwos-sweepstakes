import { notFound } from "next/navigation";
import { poolAccess } from "@/lib/pool-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { DrawBoard } from "./draw-board";

export const revalidate = 0;

export default async function DrawPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await poolAccess(slug)).allowed) return null;
  const admin = createAdminClient();

  const { data: sw } = await admin
    .from("sweepstakes")
    .select("id,name,slug,status,draw_at")
    .eq("slug", slug)
    .single();
  if (!sw) notFound();

  const { data: entries } = await admin
    .from("entries")
    .select("id,display_name")
    .eq("sweepstakes_id", sw.id)
    .eq("status", "active")
    .order("created_at");

  const { data: draw } = await admin
    .from("draws")
    .select("id,status,seed_hash,seed")
    .eq("sweepstakes_id", sw.id)
    .neq("status", "voided")
    .maybeSingle();

  // Already-revealed picks (late joiners catch up server-side)
  const { data: revealed } = draw
    ? await admin
        .from("draw_picks")
        .select(
          "sequence,entry_id,teams(name,abbrev,sport_id,sports(short_name,name))",
        )
        .eq("draw_id", draw.id)
        .not("revealed_at", "is", null)
        .order("sequence")
    : { data: [] };

  const initialPicks = (revealed ?? []).map((p) => {
    const t = p.teams as unknown as {
      name: string;
      abbrev: string;
      sport_id: string;
      sports: { short_name: string | null; name: string };
    };
    return {
      sequence: p.sequence,
      entryId: p.entry_id,
      team: t.name,
      abbrev: t.abbrev,
      sport: t.sports.short_name ?? t.sports.name,
      sportId: t.sport_id,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-brand-silver">
        {sw.name}
      </p>
      <h1 className="brand-script mt-1 text-center text-6xl text-brand-red">
        The Draw
      </h1>

      <DrawBoard
        sweepstakesId={sw.id}
        status={sw.status}
        drawStatus={draw?.status ?? null}
        seedHash={draw?.seed_hash ?? null}
        seed={draw?.seed ?? null}
        entries={(entries ?? []).map((e) => ({
          id: e.id,
          name: e.display_name,
        }))}
        initialPicks={initialPicks}
      />
    </div>
  );
}
