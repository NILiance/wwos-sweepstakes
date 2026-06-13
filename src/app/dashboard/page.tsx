import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My Entries — WWOS Sweepstakes" };
export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: entries }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user!.id)
      .single(),
    supabase
      .from("entries")
      .select(
        "id,display_name,status,created_at,sweepstakes(name,slug,status,season_label)",
      )
      .eq("owner_user_id", user!.id)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
  ]);

  // Claim invites sent to my email before I had an account
  if (user?.email) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    await createAdminClient()
      .from("entry_shares")
      .update({ user_id: user.id, status: "accepted" })
      .eq("invited_email", user.email.toLowerCase())
      .is("user_id", null);
  }

  // Entries shared with me (co-owner)
  const { data: sharedRows } = await supabase
    .from("entry_shares")
    .select(
      "entries(id,display_name,status,created_at,sweepstakes(name,slug,status,season_label))",
    )
    .eq("user_id", user!.id);
  const shared = (sharedRows ?? [])
    .map((s) => s.entries as unknown as NonNullable<typeof entries>[number])
    .filter((e) => e && e.status === "active");

  const list = [...(entries ?? []), ...shared] as unknown as {
    id: string;
    display_name: string;
    sweepstakes: {
      name: string;
      slug: string;
      status: string;
      season_label: string | null;
    };
  }[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">
          {profile ? `Welcome, ${profile.display_name}` : "My Entries"}
        </h1>
        <Link
          href="/dashboard/settings"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
        >
          ⚙ Payout settings
        </Link>
      </div>
      <p className="mt-2 text-muted">
        Your pools, ranks, points and upcoming games — all in one place.
      </p>

      {list.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-12 text-center text-muted">
          No entries yet.{" "}
          <Link href="/browse" className="font-semibold text-info hover:underline">
            Browse open pools →
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/entries/${e.id}`}
              className="group rounded-lg border border-border bg-surface p-6 transition hover:border-info"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold group-hover:text-info">
                  {e.sweepstakes.name}
                </h2>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs uppercase tracking-wide text-muted">
                  {e.sweepstakes.status}
                </span>
              </div>
              {e.sweepstakes.season_label && (
                <p className="mt-0.5 text-xs text-muted">
                  {e.sweepstakes.season_label}
                </p>
              )}
              <p className="mt-4 text-sm">
                Entry: <span className="font-semibold">{e.display_name}</span>
              </p>
              <p className="mt-2 text-sm text-muted">
                Roster, points history & your watch list →
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
