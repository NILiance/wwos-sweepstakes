export const metadata = { title: "My Entries — WWOS Sweepstakes" };

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-bold">My Entries</h1>
      <p className="mt-2 text-muted">
        Your pools, ranks, points and upcoming games — all in one place.
      </p>
      <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-12 text-center text-muted">
        Sign-in and entries arrive with Phase 1 — auth, checkout, and the entry
        switcher land here.
      </div>
    </div>
  );
}
