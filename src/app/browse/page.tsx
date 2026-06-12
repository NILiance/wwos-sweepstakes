export const metadata = { title: "Browse Pools — WWOS Sweepstakes" };

export default function BrowsePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-bold">Browse Pools</h1>
      <p className="mt-2 text-muted">
        Open sweepstakes will appear here once enrollment begins.
      </p>
      <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-12 text-center text-muted">
        Directory coming soon — public pools with entry price, spots remaining,
        and payout headlines. Private pools stay unlisted.
      </div>
    </div>
  );
}
