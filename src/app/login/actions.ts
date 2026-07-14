"use server";

import { createClient } from "@/lib/supabase/server";
import { logLogin } from "@/lib/activity";

/** Called by the client login form after a successful password sign-in. */
export async function recordLogin(method: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await logLogin(user.id, method);
}
