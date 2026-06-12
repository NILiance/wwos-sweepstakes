"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startDraw, revealNext } from "./actions";

export function DrawControls({
  sweepstakesId,
  hasDraw,
  drawStatus,
  revealed,
  total,
}: {
  sweepstakesId: string;
  hasDraw: boolean;
  drawStatus: string | null;
  revealed: number;
  total: number;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [count, setCount] = useState(revealed);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function handleStart() {
    setBusy(true);
    const r = await startDraw(sweepstakesId);
    setMessage(r.message);
    setBusy(false);
    router.refresh();
  }

  async function handleReveal() {
    const r = await revealNext(sweepstakesId);
    if (r.done) {
      stopAuto();
      setMessage("Draw complete — pool is now active. 🎉");
      router.refresh();
    } else {
      setCount((c) => c + 1);
    }
  }

  function startAuto(intervalMs: number) {
    stopAuto();
    setAuto(true);
    timer.current = setInterval(handleReveal, intervalMs);
  }
  function stopAuto() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setAuto(false);
  }

  return (
    <div className="mt-6 space-y-4">
      {!hasDraw && (
        <button
          onClick={handleStart}
          disabled={busy}
          className="rounded-md bg-accent px-6 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "Preparing…" : "Prepare & lock draw"}
        </button>
      )}

      {hasDraw && drawStatus === "running" && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleReveal}
            className="rounded-md bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
          >
            Reveal next pick
          </button>
          {!auto ? (
            <>
              <button
                onClick={() => startAuto(3000)}
                className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-raised"
              >
                ▶ Auto-reveal (3s)
              </button>
              <button
                onClick={() => startAuto(800)}
                className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-raised"
              >
                ⏩ Fast (0.8s)
              </button>
            </>
          ) : (
            <button
              onClick={stopAuto}
              className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-brand-red hover:bg-surface-raised"
            >
              ⏸ Pause
            </button>
          )}
          <span className="text-sm text-muted">
            {count} of {total} revealed
          </span>
        </div>
      )}

      {hasDraw && drawStatus === "completed" && (
        <p className="text-sm text-info">
          Draw completed — rosters are locked in.
        </p>
      )}

      {message && <p className="text-sm text-info">{message}</p>}
    </div>
  );
}
