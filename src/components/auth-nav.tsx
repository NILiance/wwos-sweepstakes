import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function AuthNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-md bg-accent px-4 py-2 font-semibold text-white hover:bg-accent-hover"
      >
        Sign In
      </Link>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted">
        {profile?.display_name ?? user.email}
      </span>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
