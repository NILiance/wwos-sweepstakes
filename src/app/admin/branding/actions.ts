"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeColors } from "@/lib/theme";

export async function saveBranding(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const { userId: adminId } = await requireStaff("branding");
    const admin = createAdminClient();

    // URLs arrive from browser-direct uploads (see upload-actions.ts);
    // only accept files that landed in our own media bucket.
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/site/`;
    const urlOf = (name: string) => {
      const v = formData.get(name);
      return typeof v === "string" && v.startsWith(base) ? v : null;
    };
    const logoUrl = urlOf("logo_url");
    const faviconUrl = urlOf("favicon_url");
    const heroUrl = urlOf("hero_url");

    const colors = sanitizeColors({
      background: formData.get("background"),
      surface: formData.get("surface"),
      accent: formData.get("accent"),
      info: formData.get("info"),
      muted: formData.get("muted"),
      logoHeight: formData.get("logoHeight"),
    });

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
