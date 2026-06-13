import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffSection =
  | "overview"
  | "sweepstakes"
  | "products"
  | "branding"
  | "simulator"
  | "dataops"
  | "payouts"
  | "settings"
  | "users";

export type StaffContext = {
  userId: string;
  role: "staff" | "admin";
  permissions: StaffSection[];
};

/** Sections a staff context can see (admins see everything). */
export function allowedSections(ctx: StaffContext): StaffSection[] {
  if (ctx.role === "admin") {
    return ["overview", "sweepstakes", "products", "branding", "simulator", "dataops", "payouts", "users", "settings"];
  }
  return ctx.permissions;
}

/**
 * Server-side backend gate. Admins pass everything; staff need the section
 * in their permissions. Others get redirected.
 */
export async function requireStaff(
  section?: StaffSection,
): Promise<StaffContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  // select(*) keeps this working before/after the role migration lands
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const role: string =
    profile?.role ?? (profile?.is_admin ? "admin" : "user");
  if (role !== "admin" && role !== "staff") redirect("/");

  const permissions = (
    Array.isArray(profile?.permissions) ? profile!.permissions : []
  ) as StaffSection[];

  const ctx: StaffContext = { userId: user.id, role, permissions };
  if (section && role !== "admin" && !permissions.includes(section)) {
    redirect("/admin");
  }
  return ctx;
}

/** Full-admin-only gate (user management, destructive ops). */
export async function requireAdmin(): Promise<string> {
  const ctx = await requireStaff();
  if (ctx.role !== "admin") redirect("/admin");
  return ctx.userId;
}

import { createAdminClient } from "@/lib/supabase/admin";

/** Commissioner area gate. Returns user id + subscription status. */
export async function requireCommissioner(): Promise<{
  userId: string;
  active: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/commissioner");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,is_admin")
    .eq("id", user.id)
    .single();
  const role = profile?.role ?? (profile?.is_admin ? "admin" : "user");

  // Admins always allowed
  if (role === "admin") return { userId: user.id, active: true };
  if (role !== "commissioner") redirect("/commissioner/join");

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("commissioner_subscriptions")
    .select("status,paid_through")
    .eq("user_id", user.id)
    .maybeSingle();
  const active =
    sub?.status === "active" &&
    (!sub.paid_through || new Date(sub.paid_through) > new Date());
  return { userId: user.id, active };
}

/**
 * Allow management of one league: platform admin, staff with the sweepstakes
 * permission, or the commissioner who created it. Returns the user id.
 */
export async function requireLeagueAccess(
  sweepstakesId: string,
): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,is_admin,permissions")
    .eq("id", user.id)
    .single();
  const role = profile?.role ?? (profile?.is_admin ? "admin" : "user");
  if (role === "admin") return user.id;
  const perms = Array.isArray(profile?.permissions) ? profile!.permissions : [];
  if (role === "staff" && perms.includes("sweepstakes")) return user.id;

  const admin = createAdminClient();
  const { data: sw } = await admin
    .from("sweepstakes")
    .select("created_by")
    .eq("id", sweepstakesId)
    .single();
  if (sw?.created_by === user.id) return user.id;
  redirect("/");
}
