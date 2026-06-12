"use server";

import { requireStaff, type StaffSection } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const KINDS: Record<string, { section: StaffSection; prefix: string }> = {
  logo: { section: "branding", prefix: "site/logo" },
  favicon: { section: "branding", prefix: "site/favicon" },
  hero: { section: "branding", prefix: "site/hero" },
  product: { section: "products", prefix: "products" },
};

const EXT = /^(png|jpg|jpeg|webp|gif|svg|ico)$/;

/**
 * Browser→Storage direct upload (signed URL). Bypasses Vercel's ~4.5 MB
 * request body cap; the bucket enforces mime types and the 20 MB limit.
 */
export async function createUploadUrl(
  kind: string,
  ext: string,
  subId?: string,
): Promise<{ path: string; token: string; publicUrl: string }> {
  const conf = KINDS[kind];
  if (!conf) throw new Error("Unknown upload kind");
  await requireStaff(conf.section);
  if (!EXT.test(ext.toLowerCase())) throw new Error("Unsupported file type");

  const admin = createAdminClient();
  const id = crypto.randomUUID().slice(0, 8);
  const path =
    kind === "product"
      ? `${conf.prefix}/${subId}/${id}.${ext.toLowerCase()}`
      : `${conf.prefix}-${id}.${ext.toLowerCase()}`;

  const { data, error } = await admin.storage
    .from("media")
    .createSignedUploadUrl(path);
  if (error) throw new Error(error.message);

  const { data: pub } = admin.storage.from("media").getPublicUrl(path);
  await admin.from("media_assets").insert({ bucket_path: path, kind });

  return { path, token: data.token, publicUrl: pub.publicUrl };
}
