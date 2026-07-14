import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserActivity } from "@/lib/activity";
import { PLATFORM_TZ } from "@/lib/tz";
import { ActivityTimeline } from "@/components/activity-timeline";

export const metadata = { title: "My Activity — WWOS Sweepstakes" };
export const revalidate = 0;

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/activity");

  const admin = createAdminClient();
  const [{ data: profile }, items] = await Promise.all([
    admin.from("profiles").select("timezone").eq("id", user.id).single(),
    getUserActivity(user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        ← My Entries
      </Link>
      <h1 className="mt-2 text-3xl font-bold">My Activity</h1>
      <p className="mt-1 text-sm text-muted">
        Everything you&apos;ve done here — entries, points, posts, payments and
        more. Times shown in your timezone.
      </p>
      <div className="mt-6">
        <ActivityTimeline items={items} tz={profile?.timezone ?? PLATFORM_TZ} />
      </div>
    </div>
  );
}
