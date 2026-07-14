import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserActivity } from "@/lib/activity";
import { ROLE_LABEL } from "@/lib/admin-sections";
import { PLATFORM_TZ } from "@/lib/tz";
import { ActivityTimeline } from "@/components/activity-timeline";

export const metadata = { title: "User activity — Admin" };
export const revalidate = 0;

export default async function AdminUserActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name,role,is_admin,timezone")
    .eq("id", id)
    .single();
  if (!profile) notFound();

  const [{ data: u }, items] = await Promise.all([
    admin.auth.admin.getUserById(id),
    getUserActivity(id),
  ]);

  const role = profile.role ?? (profile.is_admin ? "admin" : "user");

  return (
    <div className="max-w-2xl">
      <Link href="/admin/users" className="text-sm text-muted hover:text-foreground">
        ← Users
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">{profile.display_name}</h2>
        <span className="rounded-full bg-surface-raised px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-muted">
          {ROLE_LABEL[role] ?? role}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">{u?.user?.email}</p>

      <div className="mt-6">
        <ActivityTimeline items={items} tz={profile.timezone ?? PLATFORM_TZ} />
      </div>
    </div>
  );
}
