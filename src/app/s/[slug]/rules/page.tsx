import Link from "next/link";
import { poolAccess } from "@/lib/pool-access";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { usd, ordinal } from "@/lib/format";
import { getSponsor, formatSponsorAddress } from "@/lib/settings";
import { resolvePayouts } from "@/lib/payouts";

export const revalidate = 0;

export default async function RulesPage({
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
      "name,slug,season_label,pool_size,entry_price_cents,payout_structure,sweepstakes_sports(picks_per_entry,sports(name))",
    )
    .eq("slug", slug)
    .single();
  if (!sw) notFound();

  const payouts = resolvePayouts(
    (sw.payout_structure ?? []) as never,
    sw.pool_size * sw.entry_price_cents,
  );
  const sports = (sw.sweepstakes_sports ?? []) as unknown as {
    picks_per_entry: number;
    sports: { name: string };
  }[];
  const totalPicks = sports.reduce((n, s) => n + s.picks_per_entry, 0);
  const sponsor = await getSponsor();
  const sponsorAddress = formatSponsorAddress(sponsor);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href={`/s/${sw.slug}`} className="text-sm text-muted hover:text-foreground">
        ← {sw.name}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Official Rules</h1>
      <p className="mt-1 text-sm text-muted">
        {sw.name} · {sw.season_label}
      </p>

      <div className="prose-sm mt-8 space-y-6 leading-7">
        <section>
          <h2 className="text-lg font-bold">1. The sweepstakes</h2>
          <p className="mt-2 text-muted">
            {sw.name} is a sweepstakes limited to {sw.pool_size} entries. Each
            entry receives a roster of {totalPicks} teams/players assigned by
            random drawing across:{" "}
            {sports.map((s) => `${s.sports.name} (${s.picks_per_entry})`).join(", ")}.
            Rosters earn points for wins per the published scoring guide.
            Highest point totals at season&apos;s end win the prizes below. The
            drawing is pure chance — assignments are pre-determined by a
            cryptographically random, publicly verifiable draw, and every
            entrant&apos;s odds are identical. No skill is involved and no
            entrant can influence or improve their assignment.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">2. How to enter</h2>
          <p className="mt-2 text-muted">
            <strong>With a purchase:</strong> customers who purchase the
            featured product receive its discount offers, and one entry in this
            sweepstakes is included as a bonus with the purchase while spots
            remain.
          </p>
          <p className="mt-2 text-muted">
            <strong>Free mail-in entry (no purchase necessary):</strong> mail a
            handwritten request including your full name, email address, and
            the sweepstakes name, with a self-addressed stamped envelope, to
            the sponsor at the address below. One entry per envelope. Mail-in
            entries receive a full sweepstakes entry with identical odds, but
            do not include the product or its discount offers. Mail-in requests
            must be received while entry spots remain open.
          </p>
          {sponsorAddress ? (
            <div className="mt-3 rounded-md bg-surface p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Mail entries to
              </p>
              <p className="mt-1 whitespace-pre-line">{sponsorAddress}</p>
              {sponsor.amoeNote && (
                <p className="mt-2 text-muted">{sponsor.amoeNote}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">
              (Sponsor mailing address available on request.)
            </p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-bold">3. Prizes</h2>
          <ul className="mt-2 list-inside list-disc text-muted">
            {payouts.map((p) => (
              <li key={p.place}>
                {ordinal(p.place)} place: {usd(p.amount_cents)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted">
            Prizes are paid after final standings are confirmed. Winners of
            $600 or more must provide a completed IRS Form W-9 before payment.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">4. Eligibility</h2>
          <p className="mt-2 text-muted">
            Open to legal residents of eligible U.S. jurisdictions who are of
            legal age. Void where prohibited. Employees of the sponsor and
            their immediate families are not eligible.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">5. Scoring & disputes</h2>
          <p className="mt-2 text-muted">
            Game results are recorded from official league outcomes. Full point
            values are published on the{" "}
            <Link href={`/s/${sw.slug}/scoring`} className="text-info hover:underline">
              scoring guide
            </Link>
            . Scoring questions may be reported from your entry&apos;s points
            history; sponsor decisions on scoring disputes are final.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">6. General</h2>
          <p className="mt-2 text-muted">
            The sponsor may substitute prizes of equal value, void entries
            obtained fraudulently, and amend these rules to comply with law.
            This sweepstakes is not affiliated with, sponsored by, or endorsed
            by any professional or collegiate sports league or organization.
          </p>
        </section>
      </div>
    </div>
  );
}
