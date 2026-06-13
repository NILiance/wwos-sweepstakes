// Shared parser for the sweepstakes/league create+edit form.
// Lives in lib (not a "use server" file) so it can be a plain sync helper
// imported by both admin and commissioner server actions.

const SPORT_IDS = ["cfb", "nfl", "cbb", "nba", "wnba", "nhl", "pga", "liv", "mlb"];

export function parseConfig(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");
  let slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!/^[a-z0-9-]{2,}$/.test(slug)) throw new Error("Slug must be letters/numbers/dashes.");

  const dollars = (key: string) =>
    Math.round(Number(formData.get(key) ?? 0) * 100);

  const payoutCount = Math.min(
    100,
    Math.max(0, Number(formData.get("payout_count") ?? 4)),
  );
  const payout_structure = Array.from({ length: payoutCount }, (_, i) => i + 1)
    .map((p) => {
      const type = formData.get(`payout_type_${p}`) === "percent" ? "percent" : "flat";
      const raw = Number(formData.get(`payout_${p}`) ?? 0);
      return type === "percent"
        ? { place: p, type, percent: raw }
        : { place: p, type, amount_cents: Math.round(raw * 100) };
    })
    .filter((p) =>
      p.type === "percent" ? (p.percent ?? 0) > 0 : (p.amount_cents ?? 0) > 0,
    );

  const side_pots = [
    ["lowest_score", "sidepot_lowest"],
    ["weekly_high", "sidepot_weekly"],
    ["top_team", "sidepot_topteam"],
  ]
    .map(([type, field]) => ({ type, amount_cents: dollars(field) }))
    .filter((p) => p.amount_cents > 0);

  const sports = SPORT_IDS.filter((s) => formData.get(`sport_${s}`)).map(
    (s) => ({
      sport_id: s,
      picks_per_entry: Math.max(1, Number(formData.get(`picks_${s}`) ?? 1)),
      pool_source: "all" as const,
    }),
  );
  if (!sports.length) throw new Error("Pick at least one sport.");

  return {
    name,
    slug,
    description: String(formData.get("description") ?? "").trim() || null,
    season_label: String(formData.get("season_label") ?? "").trim() || null,
    visibility: formData.get("visibility") === "private" ? "private" : "public",
    pool_size: Math.max(2, Number(formData.get("pool_size") ?? 15)),
    entry_price_cents: dollars("entry_price"),
    payout_structure,
    side_pots,
    sports,
  };
}
