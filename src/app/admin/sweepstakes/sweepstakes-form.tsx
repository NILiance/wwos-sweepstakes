"use client";

import { useActionState } from "react";
import { createSweepstakes, updateSweepstakes } from "./actions";

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
  sports?: { sport_id: string; picks_per_entry: number }[];
};

const field =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info";

export function SweepstakesForm({ values }: { values: SweepstakesFormValues }) {
  const isEdit = !!values.id;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateSweepstakes : createSweepstakes,
    null,
  );
  const payout = (p: number) =>
    (values.payout_structure?.find((x) => x.place === p)?.amount_cents ?? 0) /
      100 || "";
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
        <p className="mt-4 text-sm font-semibold">Payouts ($)</p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((p) => (
            <label key={p} className="text-xs text-muted">
              {p === 1 ? "1st" : p === 2 ? "2nd" : p === 3 ? "3rd" : "4th"}
              <input name={`payout_${p}`} type="number" min={0} step="0.01" defaultValue={payout(p)} className={field} />
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
