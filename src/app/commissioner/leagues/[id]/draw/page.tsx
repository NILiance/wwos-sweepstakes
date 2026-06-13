import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLeagueAccess } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { DrawControls } from "@/app/admin/draw/[id]/draw-controls";
import { ScheduleDraw } from "./schedule-draw";

export const metadata = { title: "Draw Control — Commissioner" };
export const revalidate = 0;

export default async function CommissionerDrawPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireLeagueAccess(id);
  const admin = createAdminClient();

  const { data: sw } = await admin
    .from("sweepstakes")
    .select("id,name,slug,status,pool_size,draw_at,timezone,entries(id)")
    .eq("id", id)
    .single();
  if (!sw) notFound();

  const { data: draw } = await admin
    .from("draws")
    .select("id,status,seed_hash,started_at,completed_at")
    .eq("sweepstakes_id", id)
    .neq("status", "voided")
    .maybeSingle();

  const { count: revealed } = draw
    ? await admin
        .from("draw_picks")
        .select("id", { count: "exact", head: true })
        .eq("draw_id", draw.id)
        .not("revealed_at", "is", null)
    : { count: 0 };
  const { count: totalPicks } = draw
    ? await admin
        .from("draw_picks")
        .select("id", { count: "exact", head: true })
        .eq("draw_id", draw.id)
    : { count: 0 };

  return (
    <div className="max-w-2xl">
      <Link
        href={`/commissioner/leagues/${id}`}
        className="text-sm text-muted hover:text-foreground"
      >
        ← Manage league
      </Link>
      <h2 className="mt-2 text-lg font-bold">
        Draw Control — {sw.name}{" "}
        <span className="text-sm font-normal text-muted">({sw.status})</span>
      </h2>
      <p className="mt-1 text-sm text-muted">
        {(sw.entries ?? []).length} entries ·{" "}
        <Link href={`/s/${sw.slug}/draw`} className="text-info hover:underline">
          public draw page →
        </Link>
      </p>

      <ScheduleDraw
        sweepstakesId={sw.id}
        drawAt={sw.draw_at}
        timezone={sw.timezone ?? null}
      />

      {draw && (
        <div className="mt-4 rounded-md bg-surface-raised p-4 text-sm">
          <p>
            Draw <span className="font-mono text-xs">{draw.id}</span> —{" "}
            <span className="font-semibold">{draw.status}</span>
          </p>
          <p className="mt-1 text-muted">
            Fairness hash (published before reveal):{" "}
            <span className="font-mono text-xs">{draw.seed_hash}</span>
          </p>
          <p className="mt-1">
            Revealed {revealed ?? 0} of {totalPicks ?? 0}
          </p>
        </div>
      )}

      <DrawControls
        sweepstakesId={sw.id}
        hasDraw={!!draw}
        drawStatus={draw?.status ?? null}
        revealed={revealed ?? 0}
        total={totalPicks ?? 0}
      />
    </div>
  );
}
