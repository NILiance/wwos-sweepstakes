import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { SportPoolEditor } from "./pool-editor";

export const metadata = { title: "Draw Pool — Admin" };
export const revalidate = 0;

export default async function DrawPoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("sweepstakes");
  const { id } = await params;
  const admin = createAdminClient();

  const { data: sw } = await admin
    .from("sweepstakes")
    .select(
      "id,name,sweepstakes_sports(sport_id,picks_per_entry,sports(name,short_name,sort_order))",
    )
    .eq("id", id)
    .single();
  if (!sw) notFound();

  const sports = (
    sw.sweepstakes_sports as unknown as {
      sport_id: string;
      picks_per_entry: number;
      sports: { name: string; sort_order: number };
    }[]
  ).sort((a, b) => a.sports.sort_order - b.sports.sort_order);

  // Per-sport: custom pool entries (names) + auto count
  const perSport = await Promise.all(
    sports.map(async (s) => {
      const [{ data: custom }, { count: autoCount }] = await Promise.all([
        admin
          .from("sweepstakes_pool")
          .select("teams(name,abbrev)")
          .eq("sweepstakes_id", id)
          .eq("sport_id", s.sport_id),
        admin
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("sport_id", s.sport_id)
          .eq("active", true),
      ]);
      const customNames = (custom ?? []).map(
        (c) => (c.teams as unknown as { name: string }).name,
      );
      return {
        sportId: s.sport_id,
        name: s.sports.name,
        picks: s.picks_per_entry,
        autoCount: autoCount ?? 0,
        customNames,
      };
    }),
  );

  return (
    <div className="max-w-2xl">
      <Link href="/admin/sweepstakes" className="text-sm text-muted hover:text-foreground">
        ← Sweepstakes
      </Link>
      <h2 className="mt-2 text-lg font-bold">Draw pool — {sw.name}</h2>
      <p className="mt-1 text-sm text-muted">
        Each sport draws from its <strong>auto-derived pool</strong> (all active
        teams) by default. To override, paste a custom list for that sport — one
        team or golfer per line. The draw needs at least pool size × picks
        entries per sport.
      </p>
      <div className="mt-6 space-y-4">
        {perSport.map((s) => (
          <SportPoolEditor
            key={s.sportId}
            sweepstakesId={sw.id}
            sportId={s.sportId}
            sportName={s.name}
            picks={s.picks}
            autoCount={s.autoCount}
            customNames={s.customNames}
          />
        ))}
      </div>
    </div>
  );
}
