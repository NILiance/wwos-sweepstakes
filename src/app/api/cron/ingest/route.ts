import { NextResponse } from "next/server";
import { LEAGUES } from "@/lib/sportsdata";
import { runIngest } from "@/lib/ingest";

export const maxDuration = 300;

// Vercel Cron (x-vercel-cron header / CRON_SECRET bearer) or manual with secret
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const isVercelCron = request.headers.get("x-vercel-cron") !== null;
  const okSecret =
    !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !okSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const only = url.searchParams.get("league");
  const leagues = only
    ? LEAGUES.filter((l) => l === only)
    : LEAGUES;

  const results = await runIngest(leagues);

  // Weekly recap emails on Mondays (or force with ?recap=1)
  if (new Date().getUTCDay() === 1 || url.searchParams.get("recap") === "1") {
    try {
      const { sendWeeklyRecaps } = await import("@/lib/snapshots");
      (results as Record<string, unknown>).recaps = await sendWeeklyRecaps();
    } catch (err) {
      (results as Record<string, unknown>).recaps = {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Daily commissioner renewal notices (or force with ?renewals=1)
  try {
    const { sendRenewalNotices } = await import("@/lib/commissioner");
    (results as Record<string, unknown>).renewals = await sendRenewalNotices();
  } catch (err) {
    (results as Record<string, unknown>).renewals = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json({ ok: true, results });
}
