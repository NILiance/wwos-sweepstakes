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

  // select(*) keeps this working before/after the role migration lands
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? (profile?.is_admin ? "admin" : "user");
  const isStaff = role === "admin" || role === "staff";

  return (
    <div className="flex items-center gap-4">
      {isStaff && (
        <Link
          href="/admin"
          className="rounded-full border border-info/50 bg-info/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-info hover:bg-info/20"
        >
          {role === "admin" ? "Superadmin" : "Admin"}
        </Link>
      )}
      <Link
        href="/dashboard/activity"
        className="hidden text-sm text-muted hover:text-foreground sm:inline"
      >
        Activity
      </Link>
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
