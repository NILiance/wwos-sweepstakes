"use client";

import { useActionState } from "react";
import { fixGame, addManualGame } from "./game-actions";

const field =
  "rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-info";

export type ConsoleGame = {
  id: string;
  sport: string;
  label: string; // "AWY @ HOM · Jun 11"
  status: string;
  eventType: string;
  homeId: string | null;
  homeAbbrev: string | null;
  awayId: string | null;
  awayAbbrev: string | null;
  winnerId: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export function GameFixRow({
  game,
  ruleKeys,
}: {
  game: ConsoleGame;
  ruleKeys: string[];
}) {
  const [state, formAction, pending] = useActionState(fixGame, null);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-2 rounded-md bg-surface-raised px-3 py-2 text-sm"
    >
      <input type="hidden" name="game_id" value={game.id} />
      <span className="w-40 font-semibold">{game.label}</span>
      <input
        name="away_score"
        type="number"
        defaultValue={game.awayScore ?? ""}
        placeholder="away"
        className={`${field} w-16`}
      />
      <input
        name="home_score"
        type="number"
        defaultValue={game.homeScore ?? ""}
        placeholder="home"
        className={`${field} w-16`}
      />
      <select name="winner" defaultValue={game.winnerId ?? "none"} className={field}>
        <option value="none">no winner</option>
        {game.awayId && <option value={game.awayId}>{game.awayAbbrev} wins</option>}
        {game.homeId && <option value={game.homeId}>{game.homeAbbrev} wins</option>}
      </select>
      <select name="event_type" defaultValue={game.eventType} className={field}>
        {ruleKeys.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <select name="status" defaultValue={game.status} className={field}>
        {["final", "scheduled", "postponed", "canceled"].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save & rescore"}
      </button>
      {state && (
        <span className={`text-xs ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}

export function AddGameForm({
  sports,
  ruleKeysBySport,
}: {
  sports: string[];
  ruleKeysBySport: Record<string, string[]>;
}) {
  const [state, formAction, pending] = useActionState(addManualGame, null);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <select name="sport" className={field}>
        {sports.map((s) => (
          <option key={s} value={s}>
            {s.toUpperCase()}
          </option>
        ))}
      </select>
      <input
        name="winner_abbrev"
        required
        placeholder="Winner abbrev / golfer"
        className={`${field} w-44`}
      />
      <input name="event_type" placeholder="rule key (regular)" className={`${field} w-36`} list="rulekeys" />
      <datalist id="rulekeys">
        {[...new Set(Object.values(ruleKeysBySport).flat())].map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <input name="date" type="date" className={field} />
      <button
        disabled={pending}
        className="rounded-md border border-border px-4 py-1.5 text-sm font-semibold hover:bg-surface-raised disabled:opacity-50"
      >
        {pending ? "Recording…" : "Record result"}
      </button>
      {state && (
        <span className={`text-xs ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
