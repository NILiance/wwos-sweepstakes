import Link from "next/link";
import { getSiteTheme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { resolvePayouts, type PayoutEntry } from "@/lib/payouts";
import { usd } from "@/lib/format";

export const revalidate = 0;

const LEAGUES = [
  "College Football",
  "Pro Football",
  "College Basketball",
  "Pro Basketball",
  "Women's Basketball",
  "Hockey",
  "Golf",
  "Baseball",
];

const STEPS = [
  {
    title: "Find a pool",
    body: "Browse open sweepstakes — every season, every sport. Public pools are open to all; private pools run on an invite.",
  },
  {
    title: "Buy in",
    body: "Each pool sells an offer-packed product, and your entry comes with it as a bonus. No purchase necessary — free mail-in entry too.",
  },
  {
    title: "Draw or pick",
    body: "Get a roster assigned in a live random drawing, or fill out a bracket — depending on the pool. Pure chance, equal odds for everyone.",
  },
  {
    title: "Score & win",
    body: "Points roll in automatically as games finish, with live standings all season. Top finishers split the prize pool.",
  },
];

export default async function Home() {
  const theme = await getSiteTheme();
  const supabase = await createClient();
  const { data: openPools } = await supabase
    .from("sweepstakes")
    .select(
      "id,name,slug,season_label,status,game_mode,pool_size,entry_price_cents,payout_structure,entries(count)",
    )
    .eq("visibility", "public")
    .in("status", ["enrolling", "full", "drawing", "active"])
    .order("created_at", { ascending: false })
    .limit(3);

  const pools = (openPools ?? []) as unknown as {
    id: string;
    name: string;
    slug: string;
    season_label: string | null;
    status: string;
    game_mode: string;
    pool_size: number;
    entry_price_cents: number;
    payout_structure: PayoutEntry[];
    entries: { count: number }[];
  }[];

  return (
    <div>
      {/* Hero */}
      <section
        className="relative overflow-hidden bg-cover bg-center"
        style={
          theme?.hero_url ? { backgroundImage: `url(${theme.hero_url})` } : undefined
        }
      >
        {theme?.hero_url && <div className="absolute inset-0 bg-navy-950/75" />}
        <div className="relative mx-auto max-w-6xl px-4 py-24 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-silver">
            Wide World of
          </p>
          <h1 className="brand-script my-2 text-7xl text-brand-red sm:text-8xl">
            Sports
          </h1>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-silver">
            Sweepstakes
          </p>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-foreground/90">
            Season-long sports pools, run right. Draw a roster across every
            league or fill out a bracket — assigned by chance, scored
            automatically, with live standings the whole way.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/browse"
              className="rounded-md bg-accent px-6 py-3 text-base font-semibold text-white hover:bg-accent-hover"
            >
              Browse Pools
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-md border border-border px-6 py-3 text-base font-semibold text-foreground hover:bg-surface-raised"
            >
              How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Leagues strip */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-6">
          {LEAGUES.map((l) => (
            <span
              key={l}
              className="rounded-full border border-border bg-surface-raised px-4 py-1.5 text-sm font-semibold text-info"
            >
              {l}
            </span>
          ))}
          <span className="px-2 text-sm font-semibold text-brand-silver">
            every season, all year
          </span>
        </div>
      </section>

      {/* Open now */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between">
          <h2 className="text-3xl font-bold">Open now</h2>
          <Link href="/browse" className="text-sm font-semibold text-info hover:underline">
            See all pools →
          </Link>
        </div>
        {pools.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-border bg-surface p-10 text-center text-muted">
            No public pools are open this moment — new sweepstakes post here as
            they launch.
          </p>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pools.map((p) => {
              const pot = p.pool_size * p.entry_price_cents;
              const top = resolvePayouts(p.payout_structure ?? [], pot).find(
                (x) => x.place === 1,
              );
              const taken = p.entries?.[0]?.count ?? 0;
              const left = p.pool_size - taken;
              return (
                <Link
                  key={p.id}
                  href={`/s/${p.slug}`}
                  className="group rounded-lg border border-border bg-surface p-6 transition hover:border-info"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold group-hover:text-info">
                      {p.name}
                    </h3>
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs uppercase tracking-wide text-muted">
                      {p.game_mode === "bracket" ? "Bracket" : p.status}
                    </span>
                  </div>
                  {p.season_label && (
                    <p className="mt-0.5 text-xs text-muted">{p.season_label}</p>
                  )}
                  {top && top.amount_cents > 0 && (
                    <p className="mt-4 text-2xl font-extrabold text-brand-red">
                      {usd(top.amount_cents)}{" "}
                      <span className="text-sm font-medium text-muted">to win</span>
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                    <span className="font-semibold">{usd(p.entry_price_cents)} entry</span>
                    <span className={left <= 3 ? "font-semibold text-brand-red" : "text-muted"}>
                      {left > 0 ? `${left} of ${p.pool_size} left` : "Full"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center text-3xl font-bold">How it works</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-lg border border-border bg-background p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-lg font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two ways to play */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold">Two ways to play</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-6 text-muted">
          Jump into a pool we&apos;re running, or run your own — same engine,
          same live scoring, your crew.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="flex flex-col rounded-lg border border-border bg-surface p-8">
            <p className="text-3xl">🏆</p>
            <h3 className="mt-3 text-xl font-bold">Join one of our pools</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted">
              Pick an open pool and grab a spot. When it fills, a live,
              provably-fair drawing hands you a roster across every league in
              play — or fill out a bracket. Points roll in automatically with
              live standings, scorecards and weekly accolades all season.
            </p>
            <Link
              href="/browse"
              className="mt-5 inline-block self-start rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Browse open pools →
            </Link>
          </div>
          <div className="flex flex-col rounded-lg border border-border bg-surface p-8">
            <p className="text-3xl">🎟️</p>
            <h3 className="mt-3 text-xl font-bold">Create your own pool</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted">
              Run your own league on our platform. Set it up, register your
              members, schedule the draw, and let the scoring, standings and
              live scorecards run themselves. You manage your members and
              collect entry money your own way — we just power the tech.
            </p>
            <Link
              href="/commissioner"
              className="mt-5 inline-block self-start rounded-md border border-border px-5 py-2.5 text-sm font-semibold hover:bg-surface-raised"
            >
              Start a league →
            </Link>
          </div>
        </div>
        <p className="mt-10 text-center text-sm text-muted">
          Pure chance · equal odds for everyone · no purchase necessary to enter
        </p>
      </section>
    </div>
  );
}
