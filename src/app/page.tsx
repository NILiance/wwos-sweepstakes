import Link from "next/link";
import { getSiteTheme } from "@/lib/theme";

const SPORTS = [
  { abbrev: "College FB", picks: 4 },
  { abbrev: "Pro FB", picks: 2 },
  { abbrev: "College BB", picks: 4 },
  { abbrev: "Pro BB", picks: 2 },
  { abbrev: "Hockey", picks: 2 },
  { abbrev: "Golf", picks: 4 },
  { abbrev: "Baseball", picks: 2 },
];

const STEPS = [
  {
    title: "Buy the product",
    body: "Grab the offer-packed product — every purchase includes a bonus entry, one of 15 spots in the pool.",
  },
  {
    title: "Watch the draw",
    body: "When the pool fills, a live random drawing assigns your teams — every pick revealed in real time, equal odds for everyone.",
  },
  {
    title: "Score all season",
    body: "Your teams earn points for every win, bowl, playoff round and championship, updated on the fly.",
  },
  {
    title: "Win the pot",
    body: "Top finishers split the prize pool. $10,000 to the champion in the flagship pool.",
  },
];

export default async function Home() {
  const theme = await getSiteTheme();

  return (
    <div>
      {/* Hero */}
      <section
        className="relative overflow-hidden bg-cover bg-center"
        style={
          theme?.hero_url
            ? { backgroundImage: `url(${theme.hero_url})` }
            : undefined
        }
      >
        {theme?.hero_url && (
          <div className="absolute inset-0 bg-navy-950/75" />
        )}
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
            The best pool ever. One entry gets you a roster across eight
            sports — drawn live, scored automatically, all season long.
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

      {/* Roster strip */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-6">
          {SPORTS.map((s) => (
            <div
              key={s.abbrev}
              className="flex items-center gap-2 rounded-full border border-border bg-surface-raised px-4 py-1.5 text-sm"
            >
              <span className="font-bold text-info">{s.abbrev}</span>
              <span className="text-muted">×{s.picks}</span>
            </div>
          ))}
          <span className="px-2 text-sm font-semibold text-brand-silver">
            = 20 picks per entry
          </span>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold">How it works</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="rounded-lg border border-border bg-surface p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-lg font-bold text-white">
                {i + 1}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Payout banner */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-silver">
            Flagship pool payouts
          </p>
          <div className="mt-6 flex flex-wrap items-end justify-center gap-10">
            <div>
              <p className="text-5xl font-extrabold text-brand-red">$10,000</p>
              <p className="mt-1 text-sm text-muted">1st place</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-info">$2,500</p>
              <p className="mt-1 text-sm text-muted">2nd</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-info">$1,500</p>
              <p className="mt-1 text-sm text-muted">3rd</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-info">$1,000</p>
              <p className="mt-1 text-sm text-muted">4th</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
