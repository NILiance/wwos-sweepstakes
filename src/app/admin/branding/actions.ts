"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeColors } from "@/lib/theme";

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/gif",
]);
const MAX_BYTES = 20 * 1024 * 1024;

async function uploadAsset(
  file: File,
  prefix: string,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!IMAGE_TYPES.has(file.type) || file.size > MAX_BYTES) {
    throw new Error("Image must be PNG/JPG/WebP/SVG/ICO under 20 MB.");
  }
  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `site/${prefix}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await admin.storage
    .from("media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);

  const { data } = admin.storage.from("media").getPublicUrl(path);

  await admin.from("media_assets").insert({
    bucket_path: path,
    kind: prefix,
  });

  return data.publicUrl;
}

export async function saveBranding(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const { userId: adminId } = await requireStaff("branding");
    const admin = createAdminClient();

    const logo = formData.get("logo") as File | null;
    const favicon = formData.get("favicon") as File | null;
    const hero = formData.get("hero") as File | null;

    const colors = sanitizeColors({
      background: formData.get("background"),
      surface: formData.get("surface"),
      accent: formData.get("accent"),
      info: formData.get("info"),
      muted: formData.get("muted"),
      logoHeight: formData.get("logoHeight"),
    });

    const [logoUrl, faviconUrl, heroUrl] = await Promise.all([
      logo ? uploadAsset(logo, "logo") : null,
      favicon ? uploadAsset(favicon, "favicon") : null,
      hero ? uploadAsset(hero, "hero") : null,
    ]);

    const { data: existing } = await admin
      .from("themes")
      .select("id,colors")
      .eq("scope", "site")
      .limit(1)
      .maybeSingle();

    const patch: Record<string, unknown> = {
      colors: { ...sanitizeColors(existing?.colors), ...colors },
    };
    if (logoUrl) patch.logo_url = logoUrl;
    if (faviconUrl) patch.favicon_url = faviconUrl;
    if (heroUrl) patch.hero_url = heroUrl;

    if (existing) {
      const { error } = await admin
        .from("themes")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin
        .from("themes")
        .insert({ scope: "site", ...patch });
      if (error) throw new Error(error.message);
    }

    await admin.from("audit_log").insert({
      actor: adminId,
      action: "branding.update",
      target: "site-theme",
      detail: { colors, logo: !!logoUrl, favicon: !!faviconUrl },
    });

    revalidatePath("/", "layout");
    return { ok: true, message: "Branding saved — live everywhere." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Save failed.",
    };
  }
}

export async function resetColors(): Promise<void> {
  await requireStaff("branding");
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("themes")
    .select("id")
    .eq("scope", "site")
    .limit(1)
    .maybeSingle();
  if (existing) {
    await admin.from("themes").update({ colors: {} }).eq("id", existing.id);
  }
  revalidatePath("/", "layout");
}
