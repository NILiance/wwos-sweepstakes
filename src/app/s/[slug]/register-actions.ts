"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Self-registration for commissioner (productless) leagues. Adds the person as
 * a member/entry; the commissioner handles buy-in off-platform.
 */
export async function registerForLeague(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const slug = String(formData.get("slug"));
    const name = String(formData.get("display_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    if (!name) return { ok: false, message: "Your name is required." };

    const admin = createAdminClient();
    const { data: sw } = await admin
      .from("sweepstakes")
      .select("id,pool_size,status")
      .eq("slug", slug)
      .single();
    if (!sw) return { ok: false, message: "League not found." };
    if (sw.status !== "enrolling")
      return { ok: false, message: "This league isn't open for registration yet." };

    const { count: taken } = await admin
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("sweepstakes_id", sw.id)
      .eq("status", "active");
    if ((taken ?? 0) >= sw.pool_size)
      return { ok: false, message: "This league is full." };

    if (email) {
      const { data: dup } = await admin
        .from("entries")
        .select("id")
        .eq("sweepstakes_id", sw.id)
        .eq("email", email)
        .maybeSingle();
      if (dup)
        return { ok: false, message: "You're already registered for this league." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await admin.from("entries").insert({
      sweepstakes_id: sw.id,
      owner_user_id: user?.id ?? null,
      display_name: name,
      email,
      phone,
      status: "active",
      source: "self",
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/s/${slug}`);
    return {
      ok: true,
      message: "You're registered! The commissioner will reach out about buy-in.",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}
