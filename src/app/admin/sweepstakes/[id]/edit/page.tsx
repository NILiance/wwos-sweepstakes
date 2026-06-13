import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { SweepstakesForm } from "../../sweepstakes-form";
import { ProductsPanel } from "../../products-panel";

export const metadata = { title: "Edit Sweepstakes — Admin" };
export const revalidate = 0;

export default async function EditSweepstakesPage({
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
      "id,name,slug,description,season_label,visibility,pool_size,entry_price_cents,payout_structure,sweepstakes_sports(sport_id,picks_per_entry)",
    )
    .eq("id", id)
    .single();
  if (!sw) notFound();

  const [{ data: products }, { data: catalog }] = await Promise.all([
    admin
      .from("products")
      .select("id,name,price_cents,active")
      .eq("sweepstakes_id", id)
      .order("name"),
    admin
      .from("products")
      .select("id,name,price_cents,sweepstakes:sweepstakes_id(name)")
      .neq("sweepstakes_id", id)
      .order("name")
      .limit(50),
  ]);

  return (
    <div>
      <h2 className="text-lg font-bold">Edit — {sw.name}</h2>
      <div className="mt-6">
        <SweepstakesForm
          values={{
            id: sw.id,
            name: sw.name,
            slug: sw.slug,
            description: sw.description ?? undefined,
            season_label: sw.season_label ?? undefined,
            visibility: sw.visibility,
            pool_size: sw.pool_size,
            entry_price_cents: sw.entry_price_cents,
            payout_structure: sw.payout_structure as never,
            sports: sw.sweepstakes_sports as never,
          }}
        />
      </div>
      <ProductsPanel
        sweepstakesId={sw.id}
        products={(products ?? []) as never}
        catalog={(catalog ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          price_cents: c.price_cents,
          pool:
            (c.sweepstakes as unknown as { name: string })?.name ?? "—",
        }))}
      />
    </div>
  );
}
