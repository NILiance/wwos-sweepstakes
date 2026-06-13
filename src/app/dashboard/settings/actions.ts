"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function savePayoutMethods(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const paypal = String(formData.get("paypal") ?? "").trim();
  const venmo = String(formData.get("venmo") ?? "").trim();
  const preferred = String(formData.get("preferred") ?? "paypal");

  if (paypal && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(paypal)) {
    return { ok: false, message: "PayPal must be an email address." };
  }
  if (venmo && !/^@?[\w.-]{3,30}$/.test(venmo)) {
    return { ok: false, message: "Venmo handle looks off (letters/numbers, 3–30 chars)." };
  }

  // Replace own rows (RLS scopes everything to this user)
  await supabase.from("payout_accounts").delete().eq("user_id", user.id);
  const rows = [];
  if (paypal)
    rows.push({
      user_id: user.id,
      method: "paypal",
      identifier: paypal,
      is_preferred: preferred === "paypal",
    });
  if (venmo)
    rows.push({
      user_id: user.id,
      method: "venmo",
      identifier: venmo.startsWith("@") ? venmo : `@${venmo}`,
      is_preferred: preferred === "venmo",
    });
  if (rows.length) {
    const { error } = await supabase.from("payout_accounts").insert(rows);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Payout methods saved." };
}
