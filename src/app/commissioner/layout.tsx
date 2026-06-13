import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The /commissioner/join and /commissioner/success pages have their own gating;
// everything else requires active commissioner (or admin).
export default async function CommissionerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/commissioner");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Commissioner{" "}
          <span className="rounded-full border border-border px-2 py-0.5 align-middle text-xs font-semibold uppercase tracking-wide text-info">
            HQ
          </span>
        </h1>
        <Link href="/commissioner" className="text-sm text-muted hover:text-foreground">
          My leagues
        </Link>
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
