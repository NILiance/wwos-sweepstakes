import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Server-side admin gate. Redirects non-admins. Returns the admin user id. */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/");
  return user.id;
}
