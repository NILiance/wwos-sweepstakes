"use server";

import { createClient } from "@/lib/supabase/server";

export async function joinWaitlist(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to join the waitlist." };

  const sweepstakesId = String(formData.get("sweepstakes_id"));
  const { error } = await supabase.from("waitlist").insert({
    sweepstakes_id: sweepstakesId,
    user_id: user.id,
  });
  if (error) {
    if (error.message.includes("duplicate"))
      return { ok: true, message: "You're already on the waitlist — we'll email you when a spot opens." };
    return { ok: false, message: error.message };
  }
  return {
    ok: true,
    message: "You're on the list — first opening goes to the front of the line. 🔔",
  };
}
