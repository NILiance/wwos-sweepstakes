import { poolAccess } from "@/lib/pool-access";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { poolStandings } from "@/lib/standings";
import { resolvePayouts } from "@/lib/payouts";
import { Scorecard } from "./scorecard";

export const metadata = { title: "Scorecard" };
export const revalidate = 0;

export default async function ScorecardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await poolAccess(slug)).allowed) return null;
  const admin = createAdminClient();

  const { data: sw } = await admin
    .from("sweepstakes")
    .select(
      "id,name,slug,status,payout_structure,pool_size,entry_price_cents,sweepstakes_sports(sport_id,sports(name,short_name,sort_order))",
    )
    .eq("slug", slug)
    .single();
  if (!sw) notFound();

  const sports = (
    sw.sweepstakes_sports as unknown as {
      sport_id: string;
      sports: { name: string; short_name: string | null; sort_order: number };
    }[]
  )
    .sort((a, b) => a.sports.sort_order - b.sports.sort_order)
    .map((s) => ({
      id: s.sport_id,
      label: s.sports.short_name || s.sports.name,
    }));

  const ranked = await poolStandings(sw.id);
  const payouts = resolvePayouts(
    (sw.payout_structure ?? []) as never,
    sw.pool_size * sw.entry_price_cents,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Scorecard</h1>
      <p className="mt-1 text-sm text-muted">
        Every entrant&apos;s points by sport at a glance — like a golf scorecard.
        Standings on the right update as finals come in.
      </p>
      <Scorecard
        slug={sw.slug}
        sports={sports}
        rows={ranked.map((r, i) => ({
          id: r.id,
          name: r.name,
          total: r.total,
          rank: i + 1,
          bySport: r.bySport,
          payoutCents: payouts.find((p) => p.place === i + 1)?.amount_cents ?? null,
        }))}
      />
    </div>
  );
}
