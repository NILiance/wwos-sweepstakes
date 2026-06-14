"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_TZ, TIMEZONES } from "@/lib/tz";

export async function saveTimezone(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "Sign in first." };

    const tzInput = String(formData.get("timezone") ?? "").trim();
    const tz = TIMEZONES.includes(tzInput) ? tzInput : PLATFORM_TZ;

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ timezone: tz })
      .eq("id", user.id);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/dashboard/settings");
    return { ok: true, message: "Timezone saved." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}
