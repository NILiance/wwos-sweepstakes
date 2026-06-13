"use client";

import { useActionState, useState } from "react";
import { createSweepstakes, updateSweepstakes } from "./actions";

function ordinalLabel(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

type PlaceRow = { type: "flat" | "percent"; value: string };

function usd(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function PayoutPlaces({
  initial,
  potCents,
  sidePotCents,
}: {
  initial: { place: number; type?: string; amount_cents?: number; percent?: number }[];
  potCents: number;
  sidePotCents: number;
}) {
  const [rows, setRows] = useState<PlaceRow[]>(() => {
    const sorted = [...initial].sort((a, b) => a.place - b.place);
    const mapped = sorted.map((p) =>
      p.type === "percent"
        ? { type: "percent" as const, value: String(p.percent ?? "") }
        : { type: "flat" as const, value: String((p.amount_cents ?? 0) / 100) },
    );
    return mapped.length
      ? mapped
      : [
          { type: "flat", value: "" },
          { type: "flat", value: "" },
          { type: "flat", value: "" },
          { type: "flat", value: "" },
        ];
  });

  const set = (i: number, patch: Partial<PlaceRow>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const placeCents = rows.reduce((n, r) => {
    const v = Number(r.value) || 0;
    return n + (r.type === "percent" ? Math.round((v / 100) * potCents) : Math.round(v * 100));
  }, 0);
  const totalCents = placeCents + sidePotCents;
  const over = totalCents > potCents;

  return (
    <div className="mt-2">
      <div className="space-y-2">
        {rows.map((r, i) => {
          const resolved =
            r.type === "percent"
              ? Math.round(((Number(r.value) || 0) / 100) * potCents)
              : Math.round((Number(r.value) || 0) * 100);
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-10 text-xs text-muted">{ordinalLabel(i + 1)}</span>
              <select
                value={r.type}
                onChange={(e) => set(i, { type: e.target.value as "flat" | "percent" })}
                className="rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="flat">$ flat</option>
                <option value="percent">% of pot</option>
              </select>
              <input
                type="number"
                min={0}
                step={r.type === "percent" ? "0.5" : "0.01"}
                value={r.value}
                onChange={(e) => set(i, { value: e.target.value })}
                className="w-28 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info"
              />
              {r.type === "percent" && (
                <span className="text-xs text-muted">= {usd(resolved)}</span>
              )}
              {/* persisted fields the action reads */}
              <input type="hidden" name={`payout_type_${i + 1}`} value={r.type} />
              <input type="hidden" name={`payout_${i + 1}`} value={r.value} />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  className="text-brand-red hover:underline"
                  title="Remove this place"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
      <input type="hidden" name="payout_count" value={rows.length} />
      <button
        type="button"
        onClick={() => setRows([...rows, { type: "flat", value: "" }])}
        className="mt-2 text-sm font-semibold text-info hover:underline"
      >
        + Add payout place
      </button>

      <div className="mt-3 rounded-md bg-surface-raised px-4 py-2 text-sm">
        Pot: <span className="font-semibold">{usd(potCents)}</span> · Payouts:{" "}
        <span className="font-semibold">{usd(totalCents)}</span>
        {sidePotCents > 0 && (
          <span className="text-muted"> (incl. side pots)</span>
        )}
        {over ? (
          <p className="mt-1 font-semibold text-brand-red">
            ⚠ Payouts exceed the pot by {usd(totalCents - potCents)}. The sponsor
            covers the difference, or trim the payouts.
          </p>
        ) : (
          <p className="mt-1 text-muted">
            {usd(potCents - totalCents)} of the pot remains
            {sidePotCents === 0 ? " (before side pots)" : ""}.
          </p>
        )}
      </div>
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
  payout_structure?: {
    place: number;
    type?: string;
    amount_cents?: number;
    percent?: number;
  }[];
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

type FormAction = (
  prev: { ok: boolean; message: string } | null,
  fd: FormData,
) => Promise<{ ok: boolean; message: string }>;

export function SweepstakesForm({
  values,
  createAction,
  hideProduct = false,
}: {
  values: SweepstakesFormValues;
  createAction?: FormAction;
  hideProduct?: boolean;
}) {
  const isEdit = !!values.id;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateSweepstakes : (createAction ?? createSweepstakes),
    null,
  );
  const sportCfg = (id: string) =>
    values.sports?.find((s) => s.sport_id === id);

  const [poolSize, setPoolSize] = useState(values.pool_size ?? 15);
  const [entryPrice, setEntryPrice] = useState(
    (values.entry_price_cents ?? 100000) / 100,
  );
  const [sidePots, setSidePots] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [, type] of SIDE_POTS) {
      const v = values.side_pots?.find((s) => s.type === type)?.amount_cents;
      out[type] = v ? String(v / 100) : "";
    }
    return out;
  });
  const potCents = Math.round((Number(poolSize) || 0) * (Number(entryPrice) || 0) * 100);
  const sidePotCents = Object.values(sidePots).reduce(
    (n, v) => n + Math.round((Number(v) || 0) * 100),
    0,
  );

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
            <input
              name="pool_size"
              type="number"
              min={2}
              value={poolSize}
              onChange={(e) => setPoolSize(Number(e.target.value))}
              className={field}
            />
          </label>
          <label className="text-sm font-medium">
            Entry price ($)
            <input
              name="entry_price"
              type="number"
              min={0}
              step="0.01"
              value={entryPrice}
              onChange={(e) => setEntryPrice(Number(e.target.value))}
              className={field}
            />
          </label>
        </div>
        <p className="mt-4 text-sm font-semibold">
          Payouts{" "}
          <span className="text-xs font-normal text-muted">
            — flat $ or % of pot, as many places as you want
          </span>
        </p>
        <PayoutPlaces
          initial={values.payout_structure ?? []}
          potCents={potCents}
          sidePotCents={sidePotCents}
        />
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
                value={sidePots[type] ?? ""}
                onChange={(e) =>
                  setSidePots({ ...sidePots, [type]: e.target.value })
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

      {!isEdit && !hideProduct && (
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
        {pending
          ? "Saving…"
          : isEdit
            ? "Save changes"
            : hideProduct
              ? "Create league"
              : "Create sweepstakes"}
      </button>
    </form>
  );
}
