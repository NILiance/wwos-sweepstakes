import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDraw } from "@/lib/draw";

export const maxDuration = 300;

/**
 * Runs any league draws whose scheduled time has passed and that haven't
 * been fired yet. Vercel Cron (x-vercel-cron) or manual with CRON_SECRET.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const isVercelCron = request.headers.get("x-vercel-cron") !== null;
  const okSecret =
    !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !okSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due } = await admin
    .from("sweepstakes")
    .select("id,name,status,draw_at")
    .not("draw_at", "is", null)
    .is("draw_scheduled_run_at", null)
    .lte("draw_at", nowIso);

  const results: { id: string; name: string; ok: boolean; detail: string }[] = [];
  for (const sw of due ?? []) {
    // Claim it first (idempotency) so a retry/overlap can't double-run.
    const { data: claimed } = await admin
      .from("sweepstakes")
      .update({ draw_scheduled_run_at: nowIso })
      .eq("id", sw.id)
      .is("draw_scheduled_run_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      const { totalPicks } = await runDraw(sw.id);
      await admin
        .from("sweepstakes")
        .update({ status: "drawing" })
        .eq("id", sw.id);
      results.push({
        id: sw.id,
        name: sw.name,
        ok: true,
        detail: `${totalPicks} picks queued`,
      });
    } catch (err) {
      // Release the claim so it can be retried after the issue is fixed.
      await admin
        .from("sweepstakes")
        .update({ draw_scheduled_run_at: null })
        .eq("id", sw.id);
      results.push({
        id: sw.id,
        name: sw.name,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, ran: results.length, results });
}
