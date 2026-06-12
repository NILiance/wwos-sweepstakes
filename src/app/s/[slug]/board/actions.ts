"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function postMessage(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to post." };

  const sweepstakesId = String(formData.get("sweepstakes_id"));
  const slug = String(formData.get("slug"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false, message: "Say something first." };
  if (body.length > 1000)
    return { ok: false, message: "Keep it under 1,000 characters." };

  // RLS enforces membership (write posts policy: member of the pool)
  const { error } = await supabase.from("posts").insert({
    sweepstakes_id: sweepstakesId,
    user_id: user.id,
    body,
  });
  if (error) {
    return {
      ok: false,
      message: error.message.includes("policy")
        ? "Only entrants in this pool can post."
        : error.message,
    };
  }

  revalidatePath(`/s/${slug}/board`);
  return { ok: true, message: "" };
}
