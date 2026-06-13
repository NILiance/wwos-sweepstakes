import Link from "next/link";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResetButton } from "./reset-button";
import { DemoLoginButton } from "./demo-login-button";

export const metadata = { title: "Draw Simulator — Admin" };
export const revalidate = 0;

async function poolInfo(slug: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("sweepstakes")
    .select("id,status,entries(id),draws(id,status)")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    entries: data.entries?.length ?? 0,
    draw: (data.draws ?? []).find(
      (d: { status: string }) => d.status !== "voided",
    ) as { status: string } | undefined,
  };
}

export default async function SimulatorPage() {
  await requireStaff("simulator");
  const [sim, rehearsal] = await Promise.all([
    poolInfo("draw-simulator"),
    poolInfo("draw-rehearsal"),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      {/* Full preview pool */}
      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-bold">Full Preview 🎬</h2>
        <p className="mt-1 text-sm text-muted">
          The populated demo — instant draw, real scores from live games,
          standings, rosters, chatter. Re-running replaces all of its data.
        </p>
        {sim ? (
          <div className="mt-4 text-sm">
            <p>
              Status: <span className="font-semibold">{sim.status}</span> ·{" "}
              {sim.entries} entries
              {sim.draw && <> · draw <span className="font-semibold">{sim.draw.status}</span></>}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ResetButton label="Instant full preview" mode="preview" />
              <DemoLoginButton />
              <ResetButton label="Reset (blank field)" />
            </div>
            <div className="mt-4 flex flex-wrap gap-4">
              {[
                ["/s/draw-simulator", "Pool page"],
                ["/s/draw-simulator/standings", "Standings"],
                ["/s/draw-simulator/board", "Smack talk"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="text-info hover:underline">
                  {label} →
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <ResetButton label="Create preview pool" mode="preview" />
          </div>
        )}
      </section>

      {/* Rehearsal pool */}
      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-bold">Draw Rehearsal 🎰</h2>
        <p className="mt-1 text-sm text-muted">
          A separate pool just for practicing the live reveal show — run it as
          many times as you like without touching the Full Preview&apos;s data.
        </p>
        {rehearsal ? (
          <div className="mt-4 text-sm">
            <p>
              Status: <span className="font-semibold">{rehearsal.status}</span>{" "}
              · {rehearsal.entries} entries
              {rehearsal.draw && (
                <> · draw <span className="font-semibold">{rehearsal.draw.status}</span></>
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/admin/draw/${rehearsal.id}`}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                🎰 Draw Control (live reveal)
              </Link>
              <Link
                href="/s/draw-rehearsal/draw"
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-raised"
              >
                Watch the live board
              </Link>
              <ResetButton label="Reset rehearsal" mode="rehearsal" />
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <ResetButton label="Create rehearsal pool" mode="rehearsal" />
          </div>
        )}
        <p className="mt-4 text-xs text-muted">
          Draw-night drill: open the live board on your phone, drive reveals
          from Draw Control on your laptop.
        </p>
      </section>
    </div>
  );
}
