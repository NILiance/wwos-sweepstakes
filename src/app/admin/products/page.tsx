import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { usd } from "@/lib/format";
import { ImageUploader, RemoveImageButton, OffersEditor } from "./product-images";

export const metadata = { title: "Products — Admin" };
export const revalidate = 0;

export default async function ProductsAdmin() {
  await requireStaff("products");
  const admin = createAdminClient();

  const { data: products } = await admin
    .from("products")
    .select("id,name,description,price_cents,images,offers,active,sweepstakes(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      {(products ?? []).map((p) => {
        const images: string[] = Array.isArray(p.images) ? p.images : [];
        return (
          <div key={p.id} className="rounded-lg border border-border bg-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold">{p.name}</h2>
                <p className="text-sm text-muted">
                  {(p.sweepstakes as unknown as { name: string })?.name} ·{" "}
                  {usd(p.price_cents)} {p.active ? "" : "· inactive"}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {images.map((url) => (
                <div key={url} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={p.name}
                    className="h-28 w-28 rounded-md border border-border object-cover"
                  />
                  <RemoveImageButton productId={p.id} url={url} />
                </div>
              ))}
              {images.length === 0 && (
                <p className="text-sm text-muted">No photos yet.</p>
              )}
            </div>

            <ImageUploader productId={p.id} />
            <OffersEditor
              productId={p.id}
              offers={Array.isArray(p.offers) ? (p.offers as string[]) : []}
            />
          </div>
        );
      })}
    </div>
  );
}
