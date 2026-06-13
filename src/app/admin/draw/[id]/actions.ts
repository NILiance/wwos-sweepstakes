"use server";

import { revalidatePath } from "next/cache";
import { requireLeagueAccess } from "@/lib/admin-guard";
import { runDraw, revealNextPick } from "@/lib/draw";

export async function startDraw(
  sweepstakesId: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireLeagueAccess(sweepstakesId);
    const { totalPicks } = await runDraw(sweepstakesId);
    revalidatePath(`/admin/draw/${sweepstakesId}`);
    return { ok: true, message: `Draw prepared — ${totalPicks} picks queued.` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Draw failed.",
    };
  }
}

export async function revealNext(
  sweepstakesId: string,
): Promise<{ done: boolean }> {
  await requireLeagueAccess(sweepstakesId);
  const result = await revealNextPick(sweepstakesId);
  return { done: result.done };
}
