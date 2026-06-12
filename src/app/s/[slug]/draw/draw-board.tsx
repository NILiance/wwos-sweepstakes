"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Pick = {
  sequence: number;
  entryId: string;
  team: string;
  abbrev: string;
  sport: string;
  sportId: string;
};

export function DrawBoard({
  sweepstakesId,
  status,
  drawStatus,
  seedHash,
  seed,
  entries,
  initialPicks,
}: {
  sweepstakesId: string;
  status: string;
  drawStatus: string | null;
  seedHash: string | null;
  seed: string | null;
  entries: { id: string; name: string }[];
  initialPicks: Pick[];
}) {
  const [picks, setPicks] = useState<Pick[]>(initialPicks);
  const [latest, setLatest] = useState<Pick | null>(null);
  const [complete, setComplete] = useState(drawStatus === "completed");
  const [revealedSeed, setRevealedSeed] = useState<string | null>(seed);
  const seen = useRef(new Set(initialPicks.map((p) => p.sequence)));

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`draw:${sweepstakesId}`)
      .on("broadcast", { event: "pick" }, ({ payload }) => {
        const pick = payload as Pick;
        if (seen.current.has(pick.sequence)) return;
        seen.current.add(pick.sequence);
        setPicks((prev) => [...prev, pick]);
        setLatest(pick);
      })
      .on("broadcast", { event: "complete" }, ({ payload }) => {
        setComplete(true);
        setLatest(null);
        setRevealedSeed((payload as { seed: string | null }).seed);
      })
      .on("broadcast", { event: "started" }, () => {
        window.location.reload();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sweepstakesId]);

  const byEntry = useMemo(() => {
    const map = new Map<string, Pick[]>();
    for (const p of picks) {
      map.set(p.entryId, [...(map.get(p.entryId) ?? []), p]);
    }
    return map;
  }, [picks]);

  return (
    <div className="mt-8">
      {/* Status banner */}
      {!drawStatus && status !== "drawing" && status !== "active" && (
        <p className="text-center text-muted">
          The drawing hasn&apos;t started yet. When the pool fills, every pick
          is revealed live right here — equal odds for everyone.
        </p>
      )}

      {complete && (
        <div className="mx-auto max-w-xl rounded-lg border border-info/40 bg-surface p-6 text-center">
          <p className="brand-script text-4xl text-brand-red">That&apos;s a wrap!</p>
          <p className="mt-2 text-sm text-muted">
            All rosters are locked in. Scoring starts when the games do.
          </p>
        </div>
      )}

      {/* Latest pick spotlight */}
      {latest && !complete && (
        <div
          key={latest.sequence}
          className="mx-auto max-w-md animate-pick rounded-lg border-2 border-accent bg-surface p-6 text-center shadow-2xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-silver">
            Pick #{latest.sequence} · {latest.sport}
          </p>
          <p className="mt-2 text-5xl font-extrabold text-info">
            {latest.abbrev}
          </p>
          <p className="mt-1 text-sm text-muted">{latest.team}</p>
          <p className="mt-3 text-lg font-bold">
            → {entries.find((e) => e.id === latest.entryId)?.name}
          </p>
        </div>
      )}

      {/* Board */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((e) => {
          const mine = byEntry.get(e.id) ?? [];
          return (
            <div
              key={e.id}
              className={`rounded-lg border bg-surface p-4 transition ${
                latest?.entryId === e.id
                  ? "border-accent shadow-lg"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{e.name}</h3>
                <span className="text-xs text-muted">{mine.length} picks</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {mine.map((p) => (
                  <span
                    key={p.sequence}
                    className="animate-pick rounded-full bg-surface-raised px-2.5 py-1 text-xs font-semibold"
                    title={`${p.team} (${p.sport})`}
                  >
                    <span className="text-info">{p.abbrev}</span>
                    <span className="ml-1 text-muted">{p.sport}</span>
                  </span>
                ))}
                {mine.length === 0 && (
                  <span className="text-xs text-muted">waiting…</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fairness footer */}
      {seedHash && (
        <div className="mt-12 rounded-md bg-surface p-4 text-center text-xs text-muted">
          <p>
            Provably fair: commitment hash{" "}
            <span className="font-mono">{seedHash.slice(0, 24)}…</span>{" "}
            published before the first reveal.
          </p>
          {revealedSeed && (
            <p className="mt-1">
              Seed revealed:{" "}
              <span className="font-mono">{revealedSeed.slice(0, 24)}…</span> —
              replay the shuffle to verify every assignment.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
