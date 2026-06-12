import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My Entries — WWOS Sweepstakes" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single()
    : { data: null };

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-bold">
        {profile ? `Welcome, ${profile.display_name}` : "My Entries"}
      </h1>
      <p className="mt-2 text-muted">
        Your pools, ranks, points and upcoming games — all in one place.
      </p>
      <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-12 text-center text-muted">
        No entries yet — when enrollment opens, your pools appear here with
        rank, points, and your watch list.
      </div>
    </div>
  );
}
