"use client";

import { useActionState, useState } from "react";
import { createSweepstakes, updateSweepstakes } from "./actions";

function ordinalLabel(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function PayoutPlaces({
  initial,
}: {
  initial: { place: number; amount_cents: number }[];
}) {
  const [amounts, setAmounts] = useState<string[]>(() => {
    const sorted = [...initial].sort((a, b) => a.place - b.place);
    const vals = sorted.map((p) => String(p.amount_cents / 100));
    return vals.length ? vals : ["", "", "", ""];
  });

  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {amounts.map((amt, i) => (
          <label key={i} className="text-xs text-muted">
            <span className="flex items-center justify-between">
              {ordinalLabel(i + 1)}
              {amounts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setAmounts(amounts.filter((_, j) => j !== i))}
                  className="text-brand-red hover:underline"
                  title="Remove this place"
                >
                  ✕
                </button>
              )}
            </span>
            <input
              name={`payout_${i + 1}`}
              type="number"
              min={0}
              step="0.01"
              value={amt}
              onChange={(e) =>
                setAmounts(amounts.map((v, j) => (j === i ? e.target.value : v)))
              }
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info"
            />
          </label>
        ))}
      </div>
      <input type="hidden" name="payout_count" value={amounts.length} />
      <button
        type="button"
        onClick={() => setAmounts([...amounts, ""])}
        className="mt-2 text-sm font-semibold text-info hover:underline"
      >
        + Add payout place
      </button>
    </div>
  );
}

const SPORTS: [string, string, number][] = [
  ["cfb", "College Football", 4],
  ["nfl", "Pro Football", 2],
  ["cbb", "College Basketball", 4],
  ["nba", "Pro Basketball", 2],
  ["wnba", "Women's Pro Basketball", 2],
  ["nhl", "Pro Hockey", 2],
  ["pga", "Pro Golf — Tour", 3],
  ["liv", "Pro Golf — League", 1],
  ["mlb", "Pro Baseball", 2],
];

export type SweepstakesFormValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  season_label?: string;
  visibility?: string;
  pool_size?: number;
  entry_price_cents?: number;
  payout_structure?: { place: number; amount_cents: number }[];
  side_pots?: { type: string; amount_cents: number }[];
  sports?: { sport_id: string; picks_per_entry: number }[];
};

const SIDE_POTS: [string, string, string][] = [
  ["sidepot_lowest", "lowest_score", "Lowest season score"],
  ["sidepot_weekly", "weekly_high", "Best single week"],
  ["sidepot_topteam", "top_team", "Highest-scoring team"],
];

const field =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info";

export function SweepstakesForm({ values }: { values: SweepstakesFormValues }) {
  const isEdit = !!values.id;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateSweepstakes : createSweepstakes,
    null,
  );
  const sportCfg = (id: string) =>
    values.sports?.find((s) => s.sport_id === id);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {isEdit && <input type="hidden" name="id" value={values.id} />}

      <section className="rounded-lg border border-border bg-surface p-6">
        <h3 className="font-semibold">Basics</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Name *
            <input name="name" required defaultValue={values.name} className={field} />
          </label>
          <label className="text-sm font-medium">
            Slug (URL)
            <input name="slug" defaultValue={values.slug} placeholder="auto from name" className={field} />
          </label>
          <label className="text-sm font-medium">
            Season label
            <input name="season_label" defaultValue={values.season_label} placeholder="2026–27" className={field} />
          </label>
          <label className="text-sm font-medium">
            Visibility
            <select name="visibility" defaultValue={values.visibility ?? "public"} className={field}>
              <option value="public">Public — listed in Browse</option>
              <option value="private">Private — link/invite only</option>
            </select>
          </label>
          {!isEdit && (
            <label className="text-sm font-medium">
              Game mode
              <select name="game_mode" defaultValue="draw_roster" className={field}>
                <option value="draw_roster">Draw Roster — live random draw</option>
                <option value="bracket">Bracket Challenge — March Madness</option>
              </select>
            </label>
          )}
        </div>
        <label className="mt-4 block text-sm font-medium">
          Description
          <textarea name="description" rows={2} defaultValue={values.description} className={field} />
        </label>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h3 className="font-semibold">Pool & money</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium">
            Pool size
            <input name="pool_size" type="number" min={2} defaultValue={values.pool_size ?? 15} className={field} />
          </label>
          <label className="text-sm font-medium">
            Entry price ($)
            <input name="entry_price" type="number" min={0} step="0.01" defaultValue={(values.entry_price_cents ?? 100000) / 100} className={field} />
          </label>
        </div>
        <p className="mt-4 text-sm font-semibold">
          Payouts ($){" "}
          <span className="text-xs font-normal text-muted">
            — add as many paid places as you want
          </span>
        </p>
        <PayoutPlaces initial={values.payout_structure ?? []} />
        <p className="mt-4 text-sm font-semibold">
          Side pots ($){" "}
          <span className="text-xs font-normal text-muted">— optional, leave 0 to skip</span>
        </p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SIDE_POTS.map(([fieldName, type, label]) => (
            <label key={type} className="text-xs text-muted">
              {label}
              <input
                name={fieldName}
                type="number"
                min={0}
                step="0.01"
                defaultValue={
                  (values.side_pots?.find((s) => s.type === type)?.amount_cents ?? 0) / 100 || ""
                }
                className={field}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h3 className="font-semibold">Sports & picks per entry</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {SPORTS.map(([id, label, defPicks]) => {
            const cfg = sportCfg(id);
            const checked = values.sports ? !!cfg : ["cfb","nfl","cbb","nba","nhl","pga","liv","mlb"].includes(id);
            return (
              <label key={id} className="flex items-center justify-between gap-2 rounded-md bg-surface-raised px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <input type="checkbox" name={`sport_${id}`} defaultChecked={checked} className="accent-[var(--red-500)]" />
                  {label}
                </span>
                <input
                  name={`picks_${id}`}
                  type="number"
                  min={1}
                  max={8}
                  defaultValue={cfg?.picks_per_entry ?? defPicks}
                  className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
              </label>
            );
          })}
        </div>
      </section>

      {!isEdit && (
        <section className="rounded-lg border border-border bg-surface p-6">
          <h3 className="font-semibold">Entry product</h3>
          <p className="mt-1 text-xs text-muted">
            The product customers buy — entry is the included bonus. Add photos
            on the Products tab after creating.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Product name
              <input name="product_name" className={field} />
            </label>
            <label className="text-sm font-medium">
              Price ($, defaults to entry price)
              <input name="product_price" type="number" min={0} step="0.01" className={field} />
            </label>
          </div>
          <label className="mt-3 block text-sm font-medium">
            Product description
            <textarea name="product_description" rows={2} className={field} />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="product_shipping" defaultChecked className="accent-[var(--red-500)]" />
            Requires shipping address
          </label>
        </section>
      )}

      {state && (
        <p className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-6 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Saving…" : isEdit ? "Save changes" : "Create sweepstakes"}
      </button>
    </form>
  );
}
