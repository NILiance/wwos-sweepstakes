import Link from "next/link";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResetButton } from "./reset-button";

export const metadata = { title: "Draw Simulator — Admin" };
export const revalidate = 0;

export default async function SimulatorPage() {
  await requireStaff("simulator");
  const admin = createAdminClient();

  const { data: sim } = await admin
    .from("sweepstakes")
    .select("id,status,entries(id),draws(id,status)")
    .eq("slug", "draw-simulator")
    .maybeSingle();

  const entryCount = sim?.entries?.length ?? 0;
  const draw = (sim?.draws ?? []).find(
    (d: { status: string }) => d.status !== "voided",
  );

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold">Live Draw Simulator 🎰</h2>
      <p className="mt-1 text-sm text-muted">
        A private practice pool with the full 15-entry field (the original WWOS
        crew). Run the real draw end to end — live board, animations,
        provably-fair seed — then reset and run it again. Never appears in the
        public directory.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-surface p-6">
        {sim ? (
          <div className="text-sm">
            <p>
              Status: <span className="font-semibold">{sim.status}</span> ·{" "}
              {entryCount} entries
              {draw && (
                <>
                  {" "}
                  · draw <span className="font-semibold">{draw.status}</span>
                </>
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ResetButton label="Instant full preview" mode="preview" />
              <Link
                href={`/admin/draw/${sim.id}`}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-raised"
              >
                🎰 Draw Control (live reveal)
              </Link>
              <ResetButton label="Reset" />
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              {[
                ["/s/draw-simulator", "Pool page"],
                ["/s/draw-simulator/standings", "Standings"],
                ["/s/draw-simulator/draw", "Draw board"],
                ["/s/draw-simulator/board", "Smack talk"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="text-info hover:underline">
                  {label} →
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted">
              No simulator pool yet — create it with one click.
            </p>
            <div className="mt-4">
              <ResetButton label="Create simulator pool" />
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        Tip: open the live board on a second screen (or your phone), then drive
        reveals from Draw Control — that&apos;s exactly how draw night works.
      </p>
    </div>
  );
}
