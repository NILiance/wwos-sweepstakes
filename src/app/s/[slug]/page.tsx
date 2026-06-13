import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usd, ordinal } from "@/lib/format";
import { BuyButton } from "./buy-button";
import { ProductGallery } from "./product-gallery";
import { WaitlistButton } from "./waitlist-button";

export const revalidate = 0;

export default async function ShowcasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: sw } = await supabase
    .from("sweepstakes")
    .select(
      "id,name,slug,description,season_label,status,pool_size,entry_price_cents,payout_structure,side_pots,house_cut_pct,house_cut_flat_cents,sweepstakes_sports(sport_id,picks_per_entry,sports(name)),products(id,name,description,price_cents,requires_shipping,active,images,offers),entries(count)",
    )
    .eq("slug", slug)
    .single();

  if (!sw) notFound();

  const { data: rules } = await supabase
    .from("scoring_rules")
    .select("sport_id,rule_key,label,points")
    .is("sweepstakes_id", null)
    .eq("rule_key", "regular");

  const sports = (sw.sweepstakes_sports ?? []) as unknown as {
    sport_id: string;
    picks_per_entry: number;
    sports: { name: string };
  }[];
  const product = (sw.products ?? []).find(
    (p: { active: boolean }) => p.active,
  );
  const taken = (sw.entries?.[0] as { count: number } | undefined)?.count ?? 0;
  const left = sw.pool_size - taken;
  const totalPicks = sports.reduce((n, s) => n + s.picks_per_entry, 0);
  const pot = sw.pool_size * sw.entry_price_cents;
  const payouts = (sw.payout_structure ?? []) as {
    place: number;
    amount_cents: number;
  }[];
  const regularBySport = new Map(
    (rules ?? []).map((r) => [r.sport_id, r.points]),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-silver">
            {sw.season_label}
          </p>
          <h1 className="mt-1 text-4xl font-extrabold">{sw.name}</h1>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-info">
          {sw.status}
        </span>
      </div>
      {sw.description && (
        <p className="mt-4 max-w-2xl text-muted">{sw.description}</p>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* Left: roster + scoring */}
        <div className="space-y-8 lg:col-span-2">
          <section className="rounded-lg border border-border bg-surface p-6">
            <h2 className="text-lg font-bold">
              Your roster — {totalPicks} picks
            </h2>
            <p className="mt-1 text-sm text-muted">
              Assigned by live random drawing when the pool fills.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {sports.map((s) => (
                <div
                  key={s.sport_id}
                  className="flex items-center justify-between rounded-md bg-surface-raised px-4 py-3"
                >
                  <span className="text-sm font-medium">{s.sports.name}</span>
                  <span className="text-sm">
                    <span className="font-bold text-info">
                      ×{s.picks_per_entry}
                    </span>
                    {regularBySport.has(s.sport_id) && (
                      <span className="ml-3 text-muted">
                        {regularBySport.get(s.sport_id)} pts/win
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 flex flex-wrap gap-4 text-sm">
              <Link
                href={`/s/${sw.slug}/scoring`}
                className="font-semibold text-info hover:underline"
              >
                How points work →
              </Link>
              <Link
                href={`/s/${sw.slug}/standings`}
                className="font-semibold text-info hover:underline"
              >
                Standings →
              </Link>
              <Link
                href={`/s/${sw.slug}/board`}
                className="font-semibold text-info hover:underline"
              >
                Smack talk →
              </Link>
            </p>
          </section>

          <section className="rounded-lg border border-border bg-surface p-6">
            <h2 className="text-lg font-bold">Payouts</h2>
            <p className="mt-1 text-sm text-muted">
              {usd(pot)} pot · {sw.pool_size} entries ×{" "}
              {usd(sw.entry_price_cents)}
              {Number(sw.house_cut_pct) > 0 &&
                ` · ${sw.house_cut_pct}% house fee`}
            </p>
            <div className="mt-4 space-y-2">
              {payouts.map((p) => (
                <div
                  key={p.place}
                  className="flex items-center justify-between rounded-md bg-surface-raised px-4 py-3"
                >
                  <span className="text-sm font-medium">
                    {ordinal(p.place)} place
                  </span>
                  <span
                    className={
                      p.place === 1
                        ? "text-xl font-extrabold text-brand-red"
                        : "font-bold text-info"
                    }
                  >
                    {usd(p.amount_cents)}
                  </span>
                </div>
              ))}
            </div>
            {Array.isArray(sw.side_pots) && sw.side_pots.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Side pots
                </p>
                <div className="mt-2 space-y-2">
                  {(sw.side_pots as { type: string; amount_cents: number }[]).map((sp) => (
                    <div
                      key={sp.type}
                      className="flex items-center justify-between rounded-md bg-surface-raised px-4 py-2.5 text-sm"
                    >
                      <span>
                        {sp.type === "lowest_score"
                          ? "Lowest season score 🐢"
                          : sp.type === "weekly_high"
                            ? "Best single week 🔥"
                            : "Highest-scoring team 🚀"}
                      </span>
                      <span className="font-bold text-info">{usd(sp.amount_cents)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right: entry product */}
        <div>
          <div className="sticky top-6 rounded-lg border border-border bg-surface p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-silver">
              The Product
            </p>
            {product ? (
              <>
                <h2 className="mt-2 text-xl font-bold">{product.name}</h2>
                <ProductGallery
                  images={
                    Array.isArray(product.images)
                      ? (product.images as string[])
                      : []
                  }
                  name={product.name}
                />
                {product.description && (
                  <p className="mt-2 text-sm text-muted">
                    {product.description}
                  </p>
                )}
                {Array.isArray(product.offers) && product.offers.length > 0 && (
                  <div className="mt-4 rounded-md border border-info/30 bg-info/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-info">
                      Loaded with partner offers
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {(product.offers as string[]).map((offer) => (
                        <li key={offer} className="flex gap-2 text-sm">
                          <span className="text-info">✓</span>
                          <span>{offer}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-4 text-3xl font-extrabold">
                  {usd(product.price_cents)}
                </p>
                <BuyButton
                  sweepstakesId={sw.id}
                  productId={product.id}
                  disabled={left <= 0 || sw.status !== "enrolling"}
                />
                {(left <= 0 || sw.status === "full") && (
                  <WaitlistButton sweepstakesId={sw.id} />
                )}
                <div className="mt-4 rounded-md bg-surface-raised px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-info">
                    Bonus included
                  </p>
                  <p className="mt-1 text-sm">
                    One entry in this pool with your purchase.
                  </p>
                  <p
                    className={`mt-1 text-xs ${left <= 3 ? "font-semibold text-brand-red" : "text-muted"}`}
                  >
                    {left > 0
                      ? `${left} of ${sw.pool_size} spots remaining`
                      : "Pool is full — join the waitlist"}
                  </p>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted">
                  No purchase necessary to enter —{" "}
                  <Link
                    href={`/s/${sw.slug}/rules`}
                    className="text-info hover:underline"
                  >
                    official rules
                  </Link>{" "}
                  include the free mail-in entry method. Mail-in entries
                  don&apos;t include the product&apos;s offers.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Product not yet announced.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
