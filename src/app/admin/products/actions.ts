"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 20 * 1024 * 1024;

export async function addProductImages(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireStaff("products");
    const productId = String(formData.get("product_id"));
    const files = formData
      .getAll("images")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return { ok: false, message: "Pick at least one image." };

    const admin = createAdminClient();
    const { data: product } = await admin
      .from("products")
      .select("id,images")
      .eq("id", productId)
      .single();
    if (!product) return { ok: false, message: "Product not found." };

    const urls: string[] = [];
    for (const file of files) {
      if (!IMAGE_TYPES.has(file.type) || file.size > MAX_BYTES) {
        return {
          ok: false,
          message: `${file.name}: PNG/JPG/WebP/GIF under 5 MB only.`,
        };
      }
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `products/${productId}/${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { error } = await admin.storage
        .from("media")
        .upload(path, file, { contentType: file.type });
      if (error) return { ok: false, message: error.message };
      urls.push(admin.storage.from("media").getPublicUrl(path).data.publicUrl);
    }

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
