export type PayoutEntry = {
  place: number;
  type?: "flat" | "percent";
  amount_cents?: number; // flat
  percent?: number; // percent of pot (0–100)
};

/** Dollar value of one payout entry given the pot. */
export function resolvePayout(e: PayoutEntry, potCents: number): number {
  if (e.type === "percent") {
    return Math.round(((e.percent ?? 0) / 100) * potCents);
  }
  return e.amount_cents ?? 0;
}

/** Resolve a payout structure to concrete dollar amounts per place. */
export function resolvePayouts(
  list: PayoutEntry[],
  potCents: number,
): { place: number; amount_cents: number }[] {
  return [...list]
    .sort((a, b) => a.place - b.place)
    .map((e) => ({ place: e.place, amount_cents: resolvePayout(e, potCents) }));
}

/** Total of all payouts (place + side) in dollars, for over-pot checks. */
export function totalPayoutCents(
  list: PayoutEntry[],
  potCents: number,
): number {
  return list.reduce((n, e) => n + resolvePayout(e, potCents), 0);
}
