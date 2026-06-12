// Seed the flagship WWOS V sweepstakes (idempotent on slug).
// Usage: node scripts/seed-flagship.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function upsert(table, rows, onConflict) {
  const res = await fetch(
    `${URL_}/rest/v1/${table}?on_conflict=${onConflict}`,
    {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(rows),
    },
  );
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Series
const [series] = await upsert(
  "series",
  [{ name: "WWOS", recurrence_rule: "annual", renewal_window_days: 30 }],
  "id",
).catch(async () => {
  // series has no unique name constraint; fetch-or-create
  const existing = await fetch(`${URL_}/rest/v1/series?name=eq.WWOS&select=*`, { headers }).then((r) => r.json());
  if (existing.length) return existing;
  return upsert("series", [{ name: "WWOS", recurrence_rule: "annual" }], "id");
});
console.log("series:", series.id);

// Sweepstakes (idempotent on slug)
const existing = await fetch(
  `${URL_}/rest/v1/sweepstakes?slug=eq.wwos-v&select=id`,
  { headers },
).then((r) => r.json());

let sweepstakesId;
if (existing.length) {
  sweepstakesId = existing[0].id;
  console.log("sweepstakes exists:", sweepstakesId);
} else {
  const [sw] = await upsert(
    "sweepstakes",
    [
      {
        series_id: series.id,
        name: "WWOS V",
        slug: "wwos-v",
        description:
          "The flagship Wide World of Sports pool. 15 entries, 20 picks across eight sports, drawn live. $10,000 to the champion.",
        season_label: "2026–27",
        game_mode: "draw_roster",
        status: "enrolling",
        visibility: "public",
        pool_size: 15,
        entry_price_cents: 100000,
        payout_structure: [
          { place: 1, amount_cents: 1000000 },
          { place: 2, amount_cents: 250000 },
          { place: 3, amount_cents: 150000 },
          { place: 4, amount_cents: 100000 },
        ],
      },
    ],
    "slug",
  );
  sweepstakesId = sw.id;
  console.log("sweepstakes created:", sweepstakesId);
}

// Sports configuration (the default WWOS roster composition)
const config = [
  ["cfb", 4, "top_n", 60],
  ["nfl", 2, "all", null],
  ["cbb", 4, "top_n", 60],
  ["nba", 2, "all", null],
  ["nhl", 2, "all", null],
  ["pga", 3, "top_n", 45],
  ["liv", 1, "all", null],
  ["mlb", 2, "all", null],
];
await upsert(
  "sweepstakes_sports",
  config.map(([sport_id, picks_per_entry, pool_source, top_n]) => ({
    sweepstakes_id: sweepstakesId,
    sport_id,
    picks_per_entry,
    pool_source,
    top_n,
  })),
  "sweepstakes_id,sport_id",
);
console.log("sports config: 8 rows");

// Entry product
const prodExisting = await fetch(
  `${URL_}/rest/v1/products?sweepstakes_id=eq.${sweepstakesId}&select=id`,
  { headers },
).then((r) => r.json());
if (!prodExisting.length) {
  await upsert(
    "products",
    [
      {
        sweepstakes_id: sweepstakesId,
        name: "WWOS V Entry Cap",
        description:
          "Official WWOS V snapback. Your purchase claims one of 15 entries in the pool.",
        price_cents: 100000,
        inventory: 15,
        requires_shipping: true,
        images: [],
        active: true,
      },
    ],
    "id",
  );
  console.log("product created");
} else {
  console.log("product exists");
}

console.log("done.");
