"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveBracket } from "./actions";
import { setTruthWinnerClient } from "./truth-action";
import {
  type BracketField,
  firstRoundMatchups,
  roundOfNode,
} from "@/lib/bracket";

// Region n owns these round-4..1 node ids
const REGION_NODES = [
  { winner: 4, r3: [8, 9], r2: [16, 17, 18, 19], r1: [32, 33, 34, 35, 36, 37, 38, 39] },
  { winner: 5, r3: [10, 11], r2: [20, 21, 22, 23], r1: [40, 41, 42, 43, 44, 45, 46, 47] },
  { winner: 6, r3: [12, 13], r2: [24, 25, 26, 27], r1: [48, 49, 50, 51, 52, 53, 54, 55] },
  { winner: 7, r3: [14, 15], r2: [28, 29, 30, 31], r1: [56, 57, 58, 59, 60, 61, 62, 63] },
];

export function BracketPicker({
  field,
  initialPicks,
  locked,
  teamNames,
  tiebreaker,
  mode = "entry",
  sweepstakesId,
}: {
  field: BracketField;
  initialPicks: Record<number, string>;
  locked: boolean;
  teamNames: Record<string, string>;
  tiebreaker: number | null;
  mode?: "entry" | "truth";
  sweepstakesId?: string;
}) {
  const router = useRouter();
  const [picks, setPicks] = useState<Record<number, string>>(initialPicks);
  const [tb, setTb] = useState<string>(tiebreaker?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fr = useMemo(() => firstRoundMatchups(field), [field]);

  function competitors(node: number): [string | null, string | null] {
    if (node >= 32) {
      const m = fr[node];
      return [m?.a.teamId ?? null, m?.b.teamId ?? null];
    }
    return [picks[2 * node] ?? null, picks[2 * node + 1] ?? null];
  }

  function pick(node: number, teamId: string) {
    if (locked) return;
    setPicks((prev) => {
      const next = { ...prev, [node]: teamId };
      // clear ancestors that may have advanced the replaced team
      let a = Math.floor(node / 2);
      while (a >= 1) {
        const [ca, cb] = [next[2 * a], next[2 * a + 1]];
        if (next[a] && next[a] !== ca && next[a] !== cb) delete next[a];
        a = Math.floor(a / 2);
      }
      return next;
    });
    if (mode === "truth" && sweepstakesId) {
      setTruthWinnerClient(sweepstakesId, node, roundOfNode(node), teamId);
    }
  }

  async function submit() {
    setSaving(true);
    setMsg(null);
    const r = await saveBracket({ picks, tiebreaker: Number(tb) || null });
    setMsg(r.message);
    setSaving(false);
    if (r.ok) router.refresh();
  }

  const filled = Object.keys(picks).length;

  function Game({ node }: { node: number }) {
    const [a, b] = competitors(node);
    const opts = [a, b];
    return (
      <div className="my-1 overflow-hidden rounded-md border border-border text-xs">
        {opts.map((tid, i) => (
          <button
            key={i}
            disabled={!tid || locked}
            onClick={() => tid && pick(node, tid)}
            className={`block w-full px-2 py-1 text-left transition ${
              tid && picks[node] === tid
                ? "bg-accent font-bold text-white"
                : tid
                  ? "bg-surface hover:bg-surface-raised"
                  : "bg-surface-raised text-muted"
            } ${i === 0 ? "border-b border-border" : ""}`}
          >
            {tid ? teamNames[tid] ?? "?" : "—"}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      {locked && (
        <p className="mb-4 rounded-md bg-surface-raised px-4 py-2 text-sm text-muted">
          🔒 Picks are locked. Here&apos;s your bracket.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {field.regions.map((region, r) => {
          const rn = REGION_NODES[r];
          return (
            <div key={r} className="rounded-lg border border-border bg-surface p-3">
              <p className="mb-2 text-sm font-bold">{region.name}</p>
              <div className="flex gap-2 overflow-x-auto">
                <div className="min-w-[7rem]">
                  <p className="mb-1 text-[10px] uppercase text-muted">R64</p>
                  {rn.r1.map((n) => (
                    <Game key={n} node={n} />
                  ))}
                </div>
                <div className="min-w-[7rem]">
                  <p className="mb-1 text-[10px] uppercase text-muted">R32</p>
                  {rn.r2.map((n) => (
                    <Game key={n} node={n} />
                  ))}
                </div>
                <div className="min-w-[7rem]">
                  <p className="mb-1 text-[10px] uppercase text-muted">S16</p>
                  {rn.r3.map((n) => (
                    <Game key={n} node={n} />
                  ))}
                </div>
                <div className="min-w-[7rem]">
                  <p className="mb-1 text-[10px] uppercase text-muted">E8</p>
                  <Game node={rn.winner} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Final Four + Championship */}
      <div className="mt-6 rounded-lg border border-info/40 bg-surface p-4">
        <p className="mb-2 text-sm font-bold">Final Four & Championship</p>
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-[7rem]">
            <p className="mb-1 text-[10px] uppercase text-muted">Final Four</p>
            <Game node={2} />
            <Game node={3} />
          </div>
          <div className="min-w-[7rem]">
            <p className="mb-1 text-[10px] uppercase text-muted">Champion 🏆</p>
            <Game node={1} />
          </div>
        </div>
      </div>

      {mode === "truth" && (
        <p className="mt-4 text-sm text-info">
          Click the actual winner of each game as the tournament plays out —
          scores update live for every entrant.
        </p>
      )}

      {!locked && mode === "entry" && (
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            Tiebreaker: total points in championship game
            <input
              type="number"
              value={tb}
              onChange={(e) => setTb(e.target.value)}
              className="ml-2 w-24 rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
          </label>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-md bg-accent px-6 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? "Saving…" : `Save bracket (${filled}/63 picked)`}
          </button>
          {msg && <span className="text-sm text-info">{msg}</span>}
        </div>
      )}
    </div>
  );
}

export { roundOfNode };
