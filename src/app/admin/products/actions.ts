"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export async function addProductImages(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireStaff("products");
    const productId = String(formData.get("product_id"));
    // URLs from browser-direct uploads; only accept our bucket + this product
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/products/${productId}/`;
    const urls = formData
      .getAll("image_urls")
      .filter((u): u is string => typeof u === "string" && u.startsWith(base));
    if (!urls.length) return { ok: false, message: "Pick at least one image." };

    const admin = createAdminClient();
    const { data: product } = await admin
      .from("products")
      .select("id,images")
      .eq("id", productId)
      .single();
    if (!product) return { ok: false, message: "Product not found." };

    const images = [
      ...(Array.isArray(product.images) ? product.images : []),
      ...urls,
    ];
    await admin.from("products").update({ images }).eq("id", productId);

    revalidatePath("/admin/products");
    revalidatePath("/", "layout");
    return { ok: true, message: `${urls.length} image(s) added.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

export async function removeProductImage(formData: FormData): Promise<void> {
  await requireStaff("products");
  const productId = String(formData.get("product_id"));
  const url = String(formData.get("url"));

  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("images")
    .eq("id", productId)
    .single();
  if (!product) return;

  const images = (Array.isArray(product.images) ? product.images : []).filter(
    (u: string) => u !== url,
  );
  await admin.from("products").update({ images }).eq("id", productId);

  // best-effort storage cleanup
  const marker = "/media/";
  const path = url.slice(url.indexOf(marker) + marker.length);
  await admin.storage.from("media").remove([path]);

  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
}
